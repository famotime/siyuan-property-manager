/**
 * 属性 ⇄ 数据库（属性视图）双向同步引擎。
 *
 * 设计要点（详见 `docs/属性与数据库双向同步方案与实施计划.md`）：
 * - **事件驱动定向翻译**：只在收到内核广播的变更 op 时翻译「这一个值」，不做全表镜像，
 *   因此不存在「陈旧快照反写」导致的静默覆盖。
 * - **只写差异**：写 IAL 前先 `getBlockAttrs` 比对；写 AV 前按索引/回声令牌判断。
 * - **回声令牌**：由 AV 变更引发的 IAL 写入会登记 `(blockID, attrKey, 值)`，随后到达的
 *   对应 `updateAttrs` op 在同键同值时被跳过。既省掉一轮无谓的数据库重渲染，也避免
 *   文本列的富文本源（`text.rich`）因回写而被内核清空
 *   （`kernel/model/attribute_view.go:8166-8172`）。
 * - 插件写 AV 走 HTTP 直连 API，内核**不产生** `updateAttrViewCell` op，
 *   因此写 AV 这一步是「汇」而不是「源」，环路长度不超过 2。
 */

import type { Plugin } from 'siyuan'
import type {
  AttrChangeEvent,
  AvColumn,
  AvIndex,
  AvSyncEvent,
  AvSyncRegistryEntry,
  AvSyncStatus,
  AvSyncStorage,
} from '@/types/avSync'
import { ref } from 'vue'
import { batchSetAttributeViewBlockAttrs, getBlockAttrs, renderAttributeView, setBlockAttrs, sql } from '@/api'
import { useAttrSchema } from '@/composables/useAttrSchema'
import {
  AV_ATTR_DEBOUNCE_MS,
  AV_CELL_DEBOUNCE_MS,
  AV_ECHO_TOKEN_TTL_MS,
  AV_INDEX_TTL_MS,
  AV_SPM_ATTRS_CHANGED_EVENT,
  AV_SYNC_STORAGE_NAME,
  AV_SYNC_STORAGE_VERSION,
  AV_SYNC_WRITE_BUDGET,
  isSyncableAttrKey,
} from '@/constants/avSync'
import { getRuntimeSettings } from '@/settings'
import { decodeAvCellToIal, encodeIalToAvCell, isBlankIalValue } from '@/utils/avValueCodec'
import { classifyAvOp, collectAttrChange, parseBoundAvIds } from '@/utils/avSyncOps'
import { avSyncDebug, avSyncError, avSyncWarn } from '@/utils/logger'

interface PendingCell {
  avID: string
  blockID: string
  keyID: string
  rowID: string
  data: any
}

interface PendingAttr {
  blockID: string
  avID: string
  attrKey: string
  value: string
}

interface PendingAvValue {
  keyID: string
  itemID: string
  value: Record<string, unknown>
}

// ---- 模块级单例状态 ----

const entries = ref<Record<string, AvSyncRegistryEntry>>({})
const status = ref<Record<string, AvSyncStatus>>({})

const indices = new Map<string, AvIndex>()
const building = new Map<string, Promise<AvIndex | null>>()
const chains = new Map<string, Promise<unknown>>()
/** `blockID\0attrKey` → 本轮回声的预期值。 */
const echoTokens = new Map<string, { value: string, expiresAt: number }>()
const pendingCells = new Map<string, PendingCell>()
const pendingAttrs = new Map<string, PendingAttr>()

let cellTimer: ReturnType<typeof setTimeout> | null = null
let attrTimer: ReturnType<typeof setTimeout> | null = null
let currentPlugin: Plugin | null = null
let entriesJson = ''
let loaded = false

// ---- 小工具 ----

const SEP = '\u0000'

function echoKey(blockID: string, attrKey: string): string {
  return `${blockID}${SEP}${attrKey}`
}

function pendingAttrKey(blockID: string, avID: string, attrKey: string): string {
  return `${blockID}${SEP}${avID}${SEP}${attrKey}`
}

function quoteSqlLiteral(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`
}

/** 同一 key 上的写入串行化，避免乱序覆盖。 */
function chain<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(fn)
  chains.set(key, next)
  const settle = () => {
    if (chains.get(key) === next)
      chains.delete(key)
  }
  next.then(settle, settle)
  return next
}

function syncAllowed(): boolean {
  return loaded && currentPlugin != null && getRuntimeSettings().avSyncEnabled
}

function currentMode() {
  return getRuntimeSettings().avSyncMode
}

function setStatus(avID: string, next: AvSyncStatus): void {
  status.value = { ...status.value, [avID]: { ...next, at: Date.now() } }
}

function dispatchAttrsChanged(blockID: string): void {
  if (typeof document === 'undefined')
    return
  document.dispatchEvent(
    new CustomEvent(AV_SPM_ATTRS_CHANGED_EVENT, { detail: { blockId: blockID } }),
  )
}

function sweepEchoTokens(now = Date.now()): void {
  for (const [key, token] of echoTokens) {
    if (token.expiresAt <= now)
      echoTokens.delete(key)
  }
}

// ---- 持久化 ----

function serializeEntries(value: Record<string, AvSyncRegistryEntry>): string {
  const sorted: Record<string, AvSyncRegistryEntry> = {}
  for (const key of Object.keys(value).sort())
    sorted[key] = value[key]
  return JSON.stringify(sorted)
}

function normalizeEntries(raw: any): Record<string, AvSyncRegistryEntry> {
  const result: Record<string, AvSyncRegistryEntry> = {}
  if (!raw || typeof raw !== 'object')
    return result
  for (const avID of Object.keys(raw)) {
    const item = raw[avID]
    if (!item || typeof item !== 'object' || !avID)
      continue
    const mapping: Record<string, string> = {}
    if (item.mapping && typeof item.mapping === 'object') {
      for (const keyID of Object.keys(item.mapping)) {
        const attrKey = item.mapping[keyID]
        if (typeof attrKey === 'string' && isSyncableAttrKey(attrKey))
          mapping[keyID] = attrKey
      }
    }
    result[avID] = {
      avID,
      name: typeof item.name === 'string' ? item.name : '',
      enabled: item.enabled === true,
      mapping,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
    }
  }
  return result
}

let registrySaveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRegistrySave(): void {
  if (registrySaveTimer)
    clearTimeout(registrySaveTimer)
  registrySaveTimer = setTimeout(() => {
    registrySaveTimer = null
    void saveRegistry()
  }, 300)
}

async function saveRegistry(): Promise<void> {
  if (!currentPlugin || !loaded)
    return
  const nextJson = serializeEntries(entries.value)
  // JSON 未变化则跳过写入，避免凭空制造跨端广播（见 CLAUDE.md「不可改动项」）
  if (nextJson === entriesJson)
    return
  try {
    entriesJson = nextJson
    const payload: AvSyncStorage = {
      version: AV_SYNC_STORAGE_VERSION,
      entries: entries.value,
    }
    await currentPlugin.saveData(AV_SYNC_STORAGE_NAME, payload)
  }
  catch (err) {
    avSyncError('保存同步登记表失败', err)
  }
}

function updateEntry(avID: string, patch: Partial<AvSyncRegistryEntry>): void {
  if (!avID)
    return
  const existing = entries.value[avID]
  const next: AvSyncRegistryEntry = {
    avID,
    name: existing?.name ?? '',
    enabled: existing?.enabled ?? false,
    mapping: existing?.mapping ?? {},
    updatedAt: Date.now(),
    ...patch,
  }
  entries.value = { ...entries.value, [avID]: next }
  scheduleRegistrySave()
}

/** 把从列名推断出的映射补进登记表，使列改名后仍能对上。 */
function mergeDerivedMappings(avID: string, derived: Record<string, string>): void {
  const existing = entries.value[avID]
  if (!existing)
    return
  const keys = Object.keys(derived)
  if (keys.length === 0)
    return
  let changed = false
  const mapping = { ...existing.mapping }
  for (const keyID of keys) {
    if (mapping[keyID] === derived[keyID])
      continue
    mapping[keyID] = derived[keyID]
    changed = true
  }
  if (!changed)
    return
  updateEntry(avID, { mapping })
}

// ---- 索引 ----

function markStale(avID: string): void {
  const index = indices.get(avID)
  if (index)
    index.stale = true
}

function seedIndexFromSrcs(avID: string, srcs: Array<{ id?: string, itemID?: string, isDetached?: boolean }>): void {
  const index = indices.get(avID)
  if (!index)
    return
  for (const src of srcs) {
    if (!src.itemID)
      continue
    if (src.isDetached || !src.id) {
      index.detachedRowIds.add(src.itemID)
      continue
    }
    index.detachedRowIds.delete(src.itemID)
    index.rowToBlock.set(src.itemID, src.id)
    index.blockToRow.set(src.id, src.itemID)
  }
}

function dropRowsFromIndex(avID: string, rowIDs: string[]): void {
  const index = indices.get(avID)
  if (!index)
    return
  for (const rowID of rowIDs) {
    const blockID = index.rowToBlock.get(rowID)
    if (blockID)
      index.blockToRow.delete(blockID)
    index.rowToBlock.delete(rowID)
    index.detachedRowIds.delete(rowID)
    index.rowCells.delete(rowID)
  }
}

async function ensureIndex(avID: string, force = false): Promise<AvIndex | null> {
  if (!avID)
    return null
  const entry = entries.value[avID]
  if (!entry)
    return null

  const cached = indices.get(avID)
  if (cached && !force && !cached.stale && Date.now() - cached.builtAt < AV_INDEX_TTL_MS)
    return cached

  const inflight = building.get(avID)
  if (inflight)
    return inflight

  const task = buildIndex(avID, entry)
    .catch((err) => {
      avSyncError(`构建数据库索引失败: ${avID}`, err)
      return indices.get(avID) ?? null
    })
    .finally(() => {
      building.delete(avID)
    })
  building.set(avID, task)
  return task
}

async function buildIndex(avID: string, entry: AvSyncRegistryEntry): Promise<AvIndex | null> {
  const data = await renderAttributeView(avID)
  const view = data?.view ?? {}
  const rawColumns = Array.isArray(view.columns) ? view.columns : []
  const rawRows = Array.isArray(view.rows) ? view.rows : []

  const index: AvIndex = {
    avID,
    builtAt: Date.now(),
    blockKeyID: null,
    columns: new Map(),
    byAttrKey: new Map(),
    rowToBlock: new Map(),
    blockToRow: new Map(),
    detachedRowIds: new Set(),
    columnOrder: [],
    rowCells: new Map(),
    stale: false,
  }

  const derived: Record<string, string> = {}
  let blockColumnPos = -1

  for (const raw of rawColumns) {
    const keyID = raw?.id == null ? '' : String(raw.id)
    if (!keyID)
      continue
    const name = raw?.name == null ? '' : String(raw.name)
    const type = raw?.type == null ? 'text' : String(raw.type)

    // 映射优先级：登记表 → 列名本身即 custom- 属性名
    let attrKey: string | null = null
    const registered = entry.mapping[keyID]
    if (registered && isSyncableAttrKey(registered)) {
      attrKey = registered
    }
    else if (isSyncableAttrKey(name)) {
      attrKey = name
      derived[keyID] = name
    }

    const column: AvColumn = { keyID, name, type, attrKey }
    index.columns.set(keyID, column)
    if (attrKey && !index.byAttrKey.has(attrKey))
      index.byAttrKey.set(attrKey, column)
    index.columnOrder.push(column)
    if (type === 'block' && !index.blockKeyID) {
      index.blockKeyID = keyID
      blockColumnPos = index.columnOrder.length - 1
    }
  }

  for (const row of rawRows) {
    const itemID = row?.id == null ? '' : String(row.id)
    if (!itemID)
      continue
    const cells = Array.isArray(row.cells) ? row.cells : []
    index.rowCells.set(itemID, cells)

    const cellValue = blockColumnPos >= 0 ? cells[blockColumnPos]?.value ?? {} : {}
    const boundBlockID = cellValue?.block?.id == null ? '' : String(cellValue.block.id)
    // 主键列的 isDetached 才是可信的游离标记
    if (boundBlockID && cellValue.isDetached !== true) {
      index.rowToBlock.set(itemID, boundBlockID)
      index.blockToRow.set(boundBlockID, itemID)
    }
    else {
      index.detachedRowIds.add(itemID)
    }
  }

  indices.set(avID, index)
  mergeDerivedMappings(avID, derived)
  avSyncDebug(`索引已构建: ${avID}`, {
    columns: index.columns.size,
    bound: index.rowToBlock.size,
    detached: index.detachedRowIds.size,
  })
  return index
}

// ---- 写入 ----

async function writeIalDiffs(blockID: string, values: Array<{ attrKey: string, value: string }>): Promise<number> {
  return chain(`ial:${blockID}`, async () => {
    try {
      const attrs = (await getBlockAttrs(blockID)) ?? {}
      const patch: Record<string, string> = {}
      for (const item of values) {
        const current = attrs[item.attrKey] == null ? '' : String(attrs[item.attrKey])
        if (current !== item.value)
          patch[item.attrKey] = item.value
      }
      const keys = Object.keys(patch)
      if (keys.length === 0)
        return 0
      await setBlockAttrs(blockID, patch)
      dispatchAttrsChanged(blockID)
      avSyncDebug(`回写块属性: ${blockID}`, patch)
      return keys.length
    }
    catch (err) {
      avSyncError(`回写块属性失败: ${blockID}`, err)
      return 0
    }
  })
}

async function writeAvCells(avID: string, values: PendingAvValue[]): Promise<number> {
  if (values.length === 0)
    return 0
  return chain(`av:${avID}`, async () => {
    try {
      await batchSetAttributeViewBlockAttrs({ avID, values })
      avSyncDebug(`回写数据库单元格: ${avID}`, values.length)
      return values.length
    }
    catch (err) {
      avSyncError(`回写数据库单元格失败: ${avID}`, err)
      return 0
    }
  })
}

// ---- AV → 属性 ----

function scheduleCellFlush(): void {
  if (cellTimer)
    return
  cellTimer = setTimeout(() => {
    cellTimer = null
    void flushCells()
  }, AV_CELL_DEBOUNCE_MS)
}

async function flushCells(): Promise<void> {
  const queued = [...pendingCells.values()]
  pendingCells.clear()
  if (!syncAllowed() || queued.length === 0)
    return
  if (currentMode() === 'attr-to-av')
    return

  sweepEchoTokens()
  const byBlock = new Map<string, Array<{ attrKey: string, value: string }>>()
  let skipped = 0
  let budget = AV_SYNC_WRITE_BUDGET

  for (const item of queued) {
    const index = await ensureIndex(item.avID)
    if (!index) {
      skipped++
      continue
    }
    const column = index.columns.get(item.keyID)
    if (!column?.attrKey) {
      // 主键列、系统列、未映射列
      skipped++
      continue
    }
    const blockID = index.rowToBlock.get(item.rowID)
    if (!blockID) {
      // 游离行：无回写目标
      skipped++
      continue
    }
    const value = decodeAvCellToIal(column.type, item.data)
    if (value === null) {
      skipped++
      continue
    }
    if (budget-- <= 0) {
      avSyncWarn('已达单窗口写入上限，剩余变更被丢弃', { avID: item.avID })
      break
    }
    // 登记回声令牌：该值源自 AV，随后的 updateAttrs 不应再被搬回 AV
    echoTokens.set(echoKey(blockID, column.attrKey), {
      value,
      expiresAt: Date.now() + AV_ECHO_TOKEN_TTL_MS,
    })
    const list = byBlock.get(blockID) ?? []
    list.push({ attrKey: column.attrKey, value })
    byBlock.set(blockID, list)
  }

  let written = 0
  for (const [blockID, values] of byBlock)
    written += await writeIalDiffs(blockID, values)

  if (written > 0 || skipped > 0) {
    const avID = queued[0].avID
    setStatus(avID, { state: written > 0 ? 'done' : 'idle', written, skipped })
  }
}

// ---- 属性 → AV ----

function scheduleAttrFlush(): void {
  if (attrTimer)
    return
  attrTimer = setTimeout(() => {
    attrTimer = null
    void flushAttrs()
  }, AV_ATTR_DEBOUNCE_MS)
}

async function flushAttrs(): Promise<void> {
  const queued = [...pendingAttrs.values()]
  pendingAttrs.clear()
  if (!syncAllowed() || queued.length === 0)
    return
  if (currentMode() === 'av-to-attr')
    return

  const now = Date.now()
  sweepEchoTokens(now)
  const schema = useAttrSchema()
  const byAv = new Map<string, PendingAvValue[]>()
  let skipped = 0
  let budget = AV_SYNC_WRITE_BUDGET

  for (const item of queued) {
    const entry = entries.value[item.avID]
    if (!entry?.enabled) {
      skipped++
      continue
    }
    // 回声令牌：该值正是刚刚从 AV 写下来的，跳过以免无谓回写
    const key = echoKey(item.blockID, item.attrKey)
    const token = echoTokens.get(key)
    if (token && token.value === item.value && token.expiresAt > now) {
      echoTokens.delete(key)
      skipped++
      continue
    }

    const index = await ensureIndex(item.avID)
    if (!index) {
      skipped++
      continue
    }
    const column = index.byAttrKey.get(item.attrKey)
    const itemID = index.blockToRow.get(item.blockID)
    if (!column || !itemID) {
      skipped++
      continue
    }
    const cell = encodeIalToAvCell(column.type, item.value, schema.resolveAttrType(item.attrKey, item.value))
    if (!cell) {
      avSyncWarn('属性值无法表示为数据库单元格，已跳过', { avID: item.avID, key: item.attrKey })
      skipped++
      continue
    }
    if (budget-- <= 0) {
      avSyncWarn('已达单窗口写入上限，剩余变更被丢弃', { avID: item.avID })
      break
    }
    const list = byAv.get(item.avID) ?? []
    list.push({ keyID: column.keyID, itemID, value: cell })
    byAv.set(item.avID, list)
  }

  for (const [avID, values] of byAv) {
    const written = await writeAvCells(avID, values)
    setStatus(avID, { state: written > 0 ? 'done' : 'idle', written, skipped })
  }
}

function enqueueAttrChange(event: AttrChangeEvent, forcedAvIDs?: string[]): void {
  const avIDs = forcedAvIDs ?? parseBoundAvIds(event.next)
  if (avIDs.length === 0)
    return
  let queued = 0
  for (const avID of avIDs) {
    if (!entries.value[avID]?.enabled)
      continue
    for (const attrKey of Object.keys(event.changed)) {
      if (!isSyncableAttrKey(attrKey))
        continue
      pendingAttrs.set(pendingAttrKey(event.blockID, avID, attrKey), {
        blockID: event.blockID,
        avID,
        attrKey,
        value: event.changed[attrKey],
      })
      queued++
    }
  }
  if (queued > 0)
    scheduleAttrFlush()
}

/**
 * 块刚绑定进数据库时，用块已有的属性回填单元格。
 *
 * 内核不会替用户做这件事（`ignoreDefaultFill` 只取新建项模板/分组默认值），
 * 而用户已有的属性值显然应是真相，故此处「属性胜」。
 */
async function backfillRowFromBlock(avID: string, blockID: string): Promise<void> {
  if (!entries.value[avID]?.enabled)
    return
  try {
    const attrs = (await getBlockAttrs(blockID)) ?? {}
    const changed: Record<string, string> = {}
    for (const key of Object.keys(attrs)) {
      if (isSyncableAttrKey(key))
        changed[key] = attrs[key] == null ? '' : String(attrs[key])
    }
    const next: Record<string, string> = { ...attrs }
    if (Object.keys(changed).length === 0)
      return
    enqueueAttrChange({ blockID, changed, next }, [avID])
  }
  catch (err) {
    avSyncWarn(`绑定回填失败: ${blockID}`, err)
  }
}

// ---- op 入口 ----

function applyAvEvent(event: AvSyncEvent): void {
  if (!entries.value[event.avID]?.enabled)
    return

  switch (event.kind) {
    case 'cell':
      pendingCells.set(
        `${event.avID}${SEP}${event.keyID}${SEP}${event.rowID}`,
        {
          avID: event.avID,
          blockID: event.blockID,
          keyID: event.keyID,
          rowID: event.rowID,
          data: event.data,
        },
      )
      scheduleCellFlush()
      break

    case 'cells':
      for (const update of event.updates) {
        pendingCells.set(
          `${event.avID}${SEP}${update.keyID}${SEP}${update.rowID}`,
          {
            avID: event.avID,
            blockID: event.blockID,
            keyID: update.keyID,
            rowID: update.rowID,
            data: update.data,
          },
        )
      }
      scheduleCellFlush()
      break

    case 'rows-insert':
      seedIndexFromSrcs(event.avID, event.srcs)
      for (const src of event.srcs) {
        if (src.id && !src.isDetached)
          void backfillRowFromBlock(event.avID, src.id)
      }
      break

    case 'rows-remove':
      dropRowsFromIndex(event.avID, event.srcIDs)
      break

    case 'structural':
      markStale(event.avID)
      break
  }
}

/** 由 `index.ts` 的 ws-main 监听调用。 */
export function handleAvSyncOps(txs: any[]): void {
  if (!Array.isArray(txs) || !syncAllowed())
    return
  try {
    for (const tx of txs) {
      const ops = tx?.doOperations
      if (!Array.isArray(ops))
        continue
      for (const op of ops) {
        const attrChange = collectAttrChange(op)
        if (attrChange) {
          enqueueAttrChange(attrChange)
          continue
        }
        const event = classifyAvOp(op)
        if (event)
          applyAvEvent(event)
      }
    }
  }
  catch (err) {
    avSyncError('处理 AV 同步事件失败', err)
  }
}

// ---- 生命周期 ----

export async function initAvSync(plugin: Plugin): Promise<void> {
  currentPlugin = plugin
  try {
    const data = (await plugin.loadData(AV_SYNC_STORAGE_NAME)) as AvSyncStorage | undefined
    entries.value = data && typeof data === 'object' && data.entries
      ? normalizeEntries(data.entries)
      : {}
  }
  catch {
    entries.value = {}
  }
  entriesJson = serializeEntries(entries.value)
  loaded = true
}

export async function reloadAvSync(): Promise<void> {
  if (!currentPlugin)
    return
  try {
    const data = (await currentPlugin.loadData(AV_SYNC_STORAGE_NAME)) as AvSyncStorage | undefined
    const next = data && typeof data === 'object' && data.entries ? normalizeEntries(data.entries) : {}
    const nextJson = serializeEntries(next)
    if (nextJson === entriesJson)
      return
    entries.value = next
    entriesJson = nextJson
    // 登记表变了：列映射可能变化，索引需重建
    for (const avID of indices.keys())
      markStale(avID)
  }
  catch {
    // 忽略读取错误
  }
}

export function disposeAvSync(): void {
  for (const timer of [cellTimer, attrTimer, registrySaveTimer]) {
    if (timer)
      clearTimeout(timer)
  }
  cellTimer = null
  attrTimer = null
  registrySaveTimer = null
  pendingCells.clear()
  pendingAttrs.clear()
  echoTokens.clear()
  indices.clear()
  building.clear()
  chains.clear()
  entries.value = {}
  entriesJson = ''
  loaded = false
  currentPlugin = null
}

// ---- 对账（立即同步） ----

export interface AvSyncResult {
  /** 写入数据库单元格的项数。 */
  toAv: number
  /** 写入块属性的项数。 */
  toIal: number
  /** 两侧都有值或无法处理而跳过的项数。 */
  skipped: number
  error?: string
}

/**
 * 定向对账：遍历绑定行的每一列，**只补空**。
 *
 * - AV 空、属性有值 → 用属性填 AV
 * - 属性空、AV 有值 → 用 AV 填属性
 * - 两侧都有值且不同 → 跳过（冲突留给用户，一键同步不覆盖数据）
 */
export async function syncDatabaseNow(avID: string): Promise<AvSyncResult> {
  const result: AvSyncResult = { toAv: 0, toIal: 0, skipped: 0 }
  const entry = entries.value[avID]
  if (!entry)
    return result
  if (!syncAllowed()) {
    result.error = 'disabled'
    return result
  }

  setStatus(avID, { state: 'syncing' })
  try {
    const index = await ensureIndex(avID, true)
    if (!index || index.rowToBlock.size === 0) {
      setStatus(avID, { state: 'idle', written: 0, skipped: 0 })
      return result
    }

    const columns = index.columnOrder.filter(column => column.attrKey)
    if (columns.length === 0) {
      setStatus(avID, { state: 'idle', written: 0, skipped: 0 })
      return result
    }

    // 读块侧属性（一次查询覆盖所有绑定块与目标键）
    const blockIDs = [...index.rowToBlock.values()]
    const attrKeys = columns.map(column => column.attrKey as string)
    const attrRows = await sql(
      `SELECT block_id, name, value FROM attributes WHERE block_id IN (${blockIDs.map(quoteSqlLiteral).join(',')}) AND name IN (${attrKeys.map(quoteSqlLiteral).join(',')})`,
    )
    const ialByBlock = new Map<string, Record<string, string>>()
    for (const row of attrRows ?? []) {
      const blockID = String(row?.block_id ?? '')
      const name = String(row?.name ?? '')
      if (!blockID || !name)
        continue
      const bucket = ialByBlock.get(blockID) ?? {}
      bucket[name] = row?.value == null ? '' : String(row.value)
      ialByBlock.set(blockID, bucket)
    }

    const schema = useAttrSchema()
    const mode = currentMode()
    const avValues: PendingAvValue[] = []
    const ialPatches = new Map<string, Record<string, string>>()

    for (const [itemID, blockID] of index.rowToBlock) {
      const cells = index.rowCells.get(itemID) ?? []
      const blockAttrs = ialByBlock.get(blockID) ?? {}
      for (let i = 0; i < index.columnOrder.length; i++) {
        const column = index.columnOrder[i]
        if (!column.attrKey)
          continue
        const avValue = decodeAvCellToIal(column.type, cells[i]?.value ?? cells[i])
        if (avValue === null)
          continue
        const ialValue = blockAttrs[column.attrKey] ?? ''
        const avBlank = isBlankIalValue(avValue)
        const ialBlank = isBlankIalValue(ialValue)

        if (avBlank && !ialBlank) {
          // 单向「数据库 → 属性」时不反向填数据库
          if (mode === 'av-to-attr') {
            result.skipped++
            continue
          }
          const cell = encodeIalToAvCell(column.type, ialValue, schema.resolveAttrType(column.attrKey, ialValue))
          if (!cell) {
            result.skipped++
            continue
          }
          avValues.push({ keyID: column.keyID, itemID, value: cell })
        }
        else if (!avBlank && ialBlank) {
          // 单向「属性 → 数据库」时不反向填属性
          if (mode === 'attr-to-av') {
            result.skipped++
            continue
          }
          echoTokens.set(echoKey(blockID, column.attrKey), {
            value: avValue,
            expiresAt: Date.now() + AV_ECHO_TOKEN_TTL_MS,
          })
          const patch = ialPatches.get(blockID) ?? {}
          patch[column.attrKey] = avValue
          ialPatches.set(blockID, patch)
        }
        else {
          result.skipped++
        }
      }
    }

    result.toAv += await writeAvCells(avID, avValues)
    for (const [blockID, patch] of ialPatches)
      result.toIal += await writeIalDiffs(blockID, Object.entries(patch).map(([attrKey, value]) => ({ attrKey, value })))

    setStatus(avID, {
      state: result.error ? 'error' : 'done',
      written: result.toAv + result.toIal,
      skipped: result.skipped,
      message: result.error,
    })
  }
  catch (err: any) {
    result.error = err?.message ?? String(err)
    avSyncError(`对账失败: ${avID}`, err)
    setStatus(avID, { state: 'error', message: result.error })
  }
  return result
}

// ---- 供 UI 使用 ----

export function useAvSync() {
  function isEnabled(avID: string): boolean {
    return entries.value[avID]?.enabled === true
  }

  function setEnabled(avID: string, enabled: boolean, name?: string): void {
    updateEntry(avID, {
      enabled,
      ...(name !== undefined ? { name } : {}),
    })
    if (enabled)
      markStale(avID)
  }

  /** 建表时登记该数据库（精确记录列 keyID → 属性名，不依赖列名推断）。 */
  function registerDatabase(avID: string, name: string, mapping: Record<string, string>): void {
    const cleanMapping: Record<string, string> = {}
    for (const keyID of Object.keys(mapping ?? {})) {
      const attrKey = mapping[keyID]
      if (typeof attrKey === 'string' && isSyncableAttrKey(attrKey))
        cleanMapping[keyID] = attrKey
    }
    updateEntry(avID, { name: name ?? '', enabled: true, mapping: cleanMapping })
  }

  function refreshIndex(avID: string): Promise<AvIndex | null> {
    markStale(avID)
    return ensureIndex(avID, true)
  }

  return {
    entries,
    status,
    isEnabled,
    setEnabled,
    registerDatabase,
    refreshIndex,
    syncNow: syncDatabaseNow,
  }
}
