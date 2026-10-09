import type { AttrChangeEvent, AvSyncEvent } from '@/types/avSync'
import {
  AV_OP_INSERT_BLOCK,
  AV_OP_REMOVE_BLOCK,
  AV_OP_UPDATE_CELL,
  AV_OP_UPDATE_CELLS,
  AV_STRUCTURAL_ACTIONS,
  isSyncableAttrKey,
} from '@/constants/avSync'

/**
 * 把 ws-main 的 `transactions` op 归一化为同步引擎可消费的事件。
 *
 * 纯函数，无副作用，便于单测。内核依据：
 * - `updateAttrViewCell` / `updateAttrViewCells` / `insertAttrViewBlock` / `removeAttrViewBlock`
 *   （`kernel/model/transaction.go:344-359`、`kernel/model/attribute_view.go:6408-6417`）
 * - 前端构造的 op 字段见 `app/src/protyle/render/av/cellValue.ts:176-191`
 */

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : []
}

function str(value: any): string {
  return typeof value === 'string' ? value : ''
}

/** op 是否为可广播的 AV 变更（与内核 `shouldBroadcastAttrViewTransactions` 同源判断）。 */
export function isAttrViewAction(action: string): boolean {
  const lower = (action || '').toLowerCase()
  return lower !== 'setattrviewname' && lower.includes('attrview')
}

/** 分类单个 AV op；非 AV op 返回 null。 */
export function classifyAvOp(op: any): AvSyncEvent | null {
  if (!op || typeof op !== 'object')
    return null

  const action = str(op.action)
  if (!isAttrViewAction(action))
    return null

  const avID = str(op.avID)
  const blockID = str(op.blockID)
  if (!avID)
    return null

  if (action === AV_OP_UPDATE_CELL) {
    const keyID = str(op.keyID)
    const rowID = str(op.rowID)
    if (!keyID || !rowID)
      return null
    return { kind: 'cell', avID, blockID, keyID, rowID, data: op.data }
  }

  if (action === AV_OP_UPDATE_CELLS) {
    const updates = asArray(op.cellUpdates)
      .map(cell => ({
        keyID: str(cell?.keyID),
        rowID: str(cell?.rowID),
        data: cell?.data,
      }))
      .filter(cell => cell.keyID && cell.rowID)
    if (updates.length === 0)
      return null
    return { kind: 'cells', avID, blockID, updates }
  }

  if (action === AV_OP_INSERT_BLOCK) {
    const srcs = asArray(op.srcs).map(src => ({
      id: typeof src?.id === 'string' ? src.id : undefined,
      itemID: typeof src?.itemID === 'string' ? src.itemID : undefined,
      isDetached: src?.isDetached === true,
    }))
    if (srcs.length === 0)
      return null
    return { kind: 'rows-insert', avID, blockID, srcs }
  }

  if (action === AV_OP_REMOVE_BLOCK) {
    const srcIDs = asArray(op.srcIDs).filter((id: any) => typeof id === 'string' && id)
    if (srcIDs.length === 0)
      return null
    return { kind: 'rows-remove', avID, blockID, srcIDs }
  }

  // 其余含 attrview 的 op 一律视为结构性变更，保守失效索引。
  if (AV_STRUCTURAL_ACTIONS.has(action) || isAttrViewAction(action))
    return { kind: 'structural', avID, blockID, action }

  return null
}

/**
 * 从 `updateAttrs` op 中提取可同步的属性变更。
 *
 * 内核的 `pushBlockAttrs` 会带上**全量** `{ old, new }` 属性映射
 * （`kernel/model/blockial.go:538-551`），因此既能看到变更键，也能免费拿到
 * `custom-avs`（判断块属于哪个数据库）。
 */
export function collectAttrChange(op: any): AttrChangeEvent | null {
  if (!op || typeof op !== 'object' || op.action !== 'updateAttrs')
    return null

  const blockID = str(op.id) || str(op.blockID)
  if (!blockID)
    return null

  const data = op.data
  if (!data || typeof data !== 'object')
    return null

  const nextRaw = data.new
  if (!nextRaw || typeof nextRaw !== 'object')
    return null

  const next: Record<string, string> = {}
  for (const key of Object.keys(nextRaw))
    next[key] = nextRaw[key] == null ? '' : String(nextRaw[key])

  const prevRaw = data.old && typeof data.old === 'object' ? data.old : {}
  const changed: Record<string, string> = {}

  for (const key of Object.keys(next)) {
    if (!isSyncableAttrKey(key))
      continue
    const prevValue = prevRaw[key] == null ? '' : String(prevRaw[key])
    if (next[key] !== prevValue)
      changed[key] = next[key]
  }

  // 被删除的键不会出现在 new 里，需要按 old 补一遍。
  for (const key of Object.keys(prevRaw)) {
    if (!isSyncableAttrKey(key) || key in next)
      continue
    if (String(prevRaw[key] ?? '') !== '')
      changed[key] = ''
  }

  if (Object.keys(changed).length === 0)
    return null

  return { blockID, changed, next }
}

/** 解析块当前的 AV 绑定（`custom-avs`，逗号分隔）。 */
export function parseBoundAvIds(attrs: Record<string, string> | null | undefined): string[] {
  const raw = attrs?.['custom-avs']
  if (!raw)
    return []
  return String(raw)
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
}
