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
  AV_SYNC_STORAGE_NAME,
  AV_SYNC_STORAGE_VERSION,
  AV_SYNC_WRITE_BUDGET,
  isSyncableAttrKey,
} from '@/constants/avSync'
import { getRuntimeSettings } from '@/settings'
import { mergeAvSyncMappings, normalizeAvSyncEntries, serializeAvSyncEntries } from '@/utils/avSyncRegistry'
import { buildAvIndexFromView, dropAvIndexRows, seedAvIndexFromSrcs } from '@/utils/avSyncIndex'
import { sqlLiteral } from '@/utils/sqlLiteral'
import { decodeAvCellToIal, encodeIalToAvCell, isBlankIalValue } from '@/utils/avValueCodec'
import { classifyAvOp, collectAttrChange, parseBoundAvIds } from '@/utils/avSyncOps'
import { planAttrFlush, planCellFlush } from '@/utils/avSyncFlush'
import type { FlushAvWrite, FlushCellWrite } from '@/utils/avSyncFlush'
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

function pendingCellKey(avID: string, keyID: string, rowID: string): string {
  return `${avID}${SEP}${keyID}${SEP}${rowID}`
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

/** 写失败状态展示用的本地化短文案（engine 无 i18n 依赖，经 plugin 实例读取）。 */
function writeFailedMessage(): string {
  const msg = currentPlugin?.i18n?.avSyncWriteFailed as string | undefined
  return msg || 'write failed'
}

function sweepEchoTokens(now = Date.now()): void {
  for (const [key, token] of echoTokens) {
    if (token.expiresAt <= now)
      echoTokens.delete(key)
  }
}

// ---- 持久化 ----
// 纯序列化/归一化/合并逻辑在 `@/utils/avSyncRegistry`（有单元测试）。

let registrySaveTimer: ReturnType<typeof setTimeout> | null = null
/** 登记表有未落盘编辑（SM-105）：置位期间 reloadAvSync 不用远端覆盖内存态。 */
let registryDirty = false

function scheduleRegistrySave(): void {
  registryDirty = true
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
  const nextJson = serializeAvSyncEntries(entries.value)
  // JSON 未变化则跳过写入，避免凭空制造跨端广播（见 CLAUDE.md「不可改动项」）
  if (nextJson === entriesJson) {
    registryDirty = false
    return
  }
  const prevJson = entriesJson
  entriesJson = nextJson
  try {
    const payload: AvSyncStorage = {
      version: AV_SYNC_STORAGE_VERSION,
      entries: entries.value,
    }
    await currentPlugin.saveData(AV_SYNC_STORAGE_NAME, payload)
    registryDirty = false
  }
  catch (err) {
    // 写入失败：回退基线并保持脏标记，等待下次触发重试；期间 reload 不覆盖本地编辑
    entriesJson = prevJson
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
  const merged = mergeAvSyncMappings(existing.mapping, derived)
  if (merged)
    updateEntry(avID, { mapping: merged })
}

// ---- 索引 ----
// 纯构建/增量维护逻辑在 `@/utils/avSyncIndex`（有单元测试）。

function markStale(avID: string): void {
  const index = indices.get(avID)
  if (index)
    index.stale = true
}

function seedIndexFromSrcs(avID: string, srcs: Array<{ id?: string, itemID?: string, isDetached?: boolean }>): void {
  const index = indices.get(avID)
  if (index)
    seedAvIndexFromSrcs(index, srcs)
}

function dropRowsFromIndex(avID: string, rowIDs: string[]): void {
  const index = indices.get(avID)
  if (index)
    dropAvIndexRows(index, rowIDs)
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
  const { index, derived } = buildAvIndexFromView(avID, entry, data)

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

interface IalWriteResult {
  /** 实际落盘的属性键（与请求顺序无关联；仅含发生差异的键）。 */
  keys: string[]
  /** 写入失败（网络/内核异常）。 */
  failed: boolean
}

interface AvWriteResult {
  count: number
  failed: boolean
}

async function writeIalDiffs(blockID: string, values: Array<{ attrKey: string, value: string }>): Promise<IalWriteResult> {
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
        return { keys: [], failed: false }
      await setBlockAttrs(blockID, patch)
      // 面板刷新由内核事务广播 → attrsChangedBus 统一派发，此处不再重复 dispatch（SM-112）
      avSyncDebug(`回写块属性: ${blockID}`, patch)
      return { keys, failed: false }
    }
    catch (err) {
      avSyncError(`回写块属性失败: ${blockID}`, err)
      return { keys: [], failed: true }
    }
  })
}

async function writeAvCells(avID: string, values: PendingAvValue[]): Promise<AvWriteResult> {
  if (values.length === 0)
    return { count: 0, failed: false }
  return chain(`av:${avID}`, async () => {
    try {
      await batchSetAttributeViewBlockAttrs({ avID, values })
      avSyncDebug(`回写数据库单元格: ${avID}`, values.length)
      return { count: values.length, failed: false }
    }
    catch (err) {
      avSyncError(`回写数据库单元格失败: ${avID}`, err)
      return { count: 0, failed: true }
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

/** 冲刷单飞标记：保证任意时刻最多一波冲刷在执行，写回严格按到达序生效。 */
let cellFlushRunning = false

async function flushCells(): Promise<void> {
  const queued = [...pendingCells.values()]
  pendingCells.clear()
  if (!syncAllowed() || queued.length === 0)
    return
  // 单向模式语义：该方向的变更本不应传播，drain 后丢弃是预期行为（SM-119）
  if (currentMode() === 'attr-to-av')
    return

  // 单飞串行（SM-103）：上一波仍在执行时把本轮排队项放回队列并调度下一波，
  // 避免慢索引的旧波次晚于新波次写回、以旧值覆盖新值。
  if (cellFlushRunning) {
    for (const item of queued)
      pendingCells.set(pendingCellKey(item.avID, item.keyID, item.rowID), item)
    scheduleCellFlush()
    return
  }
  cellFlushRunning = true
  try {
    sweepEchoTokens()
    const plan = await planCellFlush(queued, {
      getIndex: avID => ensureIndex(avID),
      decode: decodeAvCellToIal,
      budget: AV_SYNC_WRITE_BUDGET,
    })

    // 按 blockID 分组写回（组内保持到达序）
    const byBlock = new Map<string, FlushCellWrite[]>()
    for (const item of plan.taken) {
      const list = byBlock.get(item.blockID) ?? []
      list.push(item)
      byBlock.set(item.blockID, list)
    }

    const writtenByAv: Record<string, number> = {}
    const failedAvIDs = new Set<string>()
    for (const [blockID, list] of byBlock) {
      const { keys, failed } = await writeIalDiffs(
        blockID,
        list.map(item => ({ attrKey: item.attrKey, value: item.value })),
      )
      if (failed) {
        for (const item of list) failedAvIDs.add(item.avID)
        continue
      }
      for (const item of list) {
        if (!keys.includes(item.attrKey))
          continue
        writtenByAv[item.avID] = (writtenByAv[item.avID] ?? 0) + 1
        // 登记回声令牌（SM-103）：写在成功之后，写失败的项不再残留令牌；
        // 内核事务广播 → enqueueAttrChange 有 120ms 防抖窗口，令牌登记必然先行。
        echoTokens.set(echoKey(item.blockID, item.attrKey), {
          value: item.value,
          expiresAt: Date.now() + AV_ECHO_TOKEN_TTL_MS,
        })
      }
    }

    // 溢出回灌：等待下一波以剩余预算重试（不再丢弃）
    for (const item of plan.overflow)
      pendingCells.set(pendingCellKey(item.avID, item.keyID, item.rowID), item)
    if (plan.overflow.length > 0) {
      avSyncWarn('已达单窗口写入上限，剩余变更延后到下一波处理', { count: plan.overflow.length })
      scheduleCellFlush()
    }

    // 状态归因：逐库 setStatus（写失败时 error 态可达，SM-109）
    const avIDs = new Set<string>([
      ...Object.keys(plan.skippedByAv),
      ...Object.keys(writtenByAv),
      ...failedAvIDs,
    ])
    for (const avID of avIDs) {
      const written = writtenByAv[avID] ?? 0
      const failed = failedAvIDs.has(avID)
      setStatus(avID, {
        state: failed ? 'error' : written > 0 ? 'done' : 'idle',
        written,
        skipped: plan.skippedByAv[avID] ?? 0,
        ...(failed ? { message: writeFailedMessage() } : {}),
      })
    }
  }
  finally {
    cellFlushRunning = false
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

/** 冲刷单飞标记：语义同 `cellFlushRunning`。 */
let attrFlushRunning = false

async function flushAttrs(): Promise<void> {
  const queued = [...pendingAttrs.values()]
  pendingAttrs.clear()
  if (!syncAllowed() || queued.length === 0)
    return
  // 单向模式语义：该方向的变更本不应传播，drain 后丢弃是预期行为（SM-119）
  if (currentMode() === 'av-to-attr')
    return

  if (attrFlushRunning) {
    for (const item of queued)
      pendingAttrs.set(pendingAttrKey(item.blockID, item.avID, item.attrKey), item)
    scheduleAttrFlush()
    return
  }
  attrFlushRunning = true
  try {
    const now = Date.now()
    sweepEchoTokens(now)
    const schema = useAttrSchema()
    const plan = await planAttrFlush(queued, {
      isEnabled: avID => entries.value[avID]?.enabled === true,
      consumeEcho: (blockID, attrKey, value) => {
        // 回声令牌：该值正是刚刚从 AV 写下来的，跳过以免无谓回写
        const key = echoKey(blockID, attrKey)
        const token = echoTokens.get(key)
        if (token && token.value === value && token.expiresAt > now) {
          echoTokens.delete(key)
          return true
        }
        return false
      },
      getIndex: avID => ensureIndex(avID),
      resolveAttrType: (attrKey, value) => schema.resolveAttrType(attrKey, value),
      encode: encodeIalToAvCell,
      budget: AV_SYNC_WRITE_BUDGET,
    })

    // 按 avID 分组写回（每个 avID 一条写链，组内保持到达序）
    const byAv = new Map<string, FlushAvWrite[]>()
    for (const item of plan.taken) {
      const list = byAv.get(item.avID) ?? []
      list.push(item)
      byAv.set(item.avID, list)
    }

    for (const [avID, values] of byAv) {
      const { count, failed } = await writeAvCells(avID, values)
      setStatus(avID, {
        state: failed ? 'error' : count > 0 ? 'done' : 'idle',
        written: count,
        skipped: plan.skippedByAv[avID] ?? 0,
        ...(failed ? { message: writeFailedMessage() } : {}),
      })
    }
    // 仅有 skipped（无写回发生）的库也要归因，避免状态卡在上一次的结果
    for (const avID of Object.keys(plan.skippedByAv)) {
      if (!byAv.has(avID))
        setStatus(avID, { state: 'idle', written: 0, skipped: plan.skippedByAv[avID] })
    }

    // 溢出回灌：等待下一波以剩余预算重试（不再丢弃，与 flushCells 对称，SM-103）
    for (const item of plan.overflow)
      pendingAttrs.set(pendingAttrKey(item.blockID, item.avID, item.attrKey), item)
    if (plan.overflow.length > 0) {
      avSyncWarn('已达单窗口写入上限，剩余变更延后到下一波处理', { count: plan.overflow.length })
      scheduleAttrFlush()
    }
  }
  finally {
    attrFlushRunning = false
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
      ? normalizeAvSyncEntries(data.entries)
      : {}
  }
  catch {
    entries.value = {}
  }
  entriesJson = serializeAvSyncEntries(entries.value)
  loaded = true
}

export async function reloadAvSync(): Promise<void> {
  if (!currentPlugin)
    return
  // 本地有未落盘编辑：跳过本轮远端覆盖（SM-105）
  if (registryDirty)
    return
  try {
    const data = (await currentPlugin.loadData(AV_SYNC_STORAGE_NAME)) as AvSyncStorage | undefined
    const next = data && typeof data === 'object' && data.entries ? normalizeAvSyncEntries(data.entries) : {}
    const nextJson = serializeAvSyncEntries(next)
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
  registryDirty = false
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
      `SELECT block_id, name, value FROM attributes WHERE block_id IN (${blockIDs.map(sqlLiteral).join(',')}) AND name IN (${attrKeys.map(sqlLiteral).join(',')})`,
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
          const patch = ialPatches.get(blockID) ?? {}
          patch[column.attrKey] = avValue
          ialPatches.set(blockID, patch)
        }
        else {
          result.skipped++
        }
      }
    }

    const avResult = await writeAvCells(avID, avValues)
    result.toAv += avResult.count
    if (avResult.failed && !result.error)
      result.error = writeFailedMessage()
    for (const [blockID, patch] of ialPatches) {
      const ialResult = await writeIalDiffs(
        blockID,
        Object.entries(patch).map(([attrKey, value]) => ({ attrKey, value })),
      )
      result.toIal += ialResult.keys.length
      if (ialResult.failed) {
        if (!result.error)
          result.error = writeFailedMessage()
        continue
      }
      // 回声令牌：写在成功之后、仅登记实际落盘的键（SM-103，写失败不残留令牌）
      for (const [attrKey, value] of Object.entries(patch)) {
        if (!ialResult.keys.includes(attrKey))
          continue
        echoTokens.set(echoKey(blockID, attrKey), {
          value,
          expiresAt: Date.now() + AV_ECHO_TOKEN_TTL_MS,
        })
      }
    }

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

  function renameAttrKeyInAvSync(oldKey: string, newKey: string): number {
    let changed = 0
    const nextEntries = { ...entries.value }
    for (const [avID, entry] of Object.entries(nextEntries)) {
      if (!entry.mapping) continue
      let entryChanged = false
      const nextMapping = { ...entry.mapping }
      for (const [keyID, attrKey] of Object.entries(nextMapping)) {
        if (attrKey === oldKey) {
          nextMapping[keyID] = newKey
          entryChanged = true
          changed++
        }
      }
      if (entryChanged) {
        nextEntries[avID] = {
          ...entry,
          mapping: nextMapping,
          updatedAt: Date.now(),
        }
      }
    }
    if (changed > 0) {
      entries.value = nextEntries
      scheduleRegistrySave()
    }
    return changed
  }

  return {
    entries,
    status,
    isEnabled,
    setEnabled,
    registerDatabase,
    refreshIndex,
    syncNow: syncDatabaseNow,
    renameAttrKeyInAvSync,
  }
}
