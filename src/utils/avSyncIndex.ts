/**
 * AV 索引（`AvIndex`）的纯构建/维护逻辑。
 *
 * 从 `useAvSync.ts` 原样抽出的 kernel-free 部分。载荷结构对应内核
 * `renderAttributeView` 的响应（`kernel/av/value.go` 的 `Value`）：
 * - `view.columns[]`：`{ id, name, type }`，`type === 'block'` 为主键列；
 * - `view.rows[].cells[]`：与列序对齐，主键列 `value.block.id` 为绑定块 ID，
 *   `value.isDetached === true` 表示游离行（内核注释：该字段仅主键列有效）。
 */

import type { AvColumn, AvIndex, AvSyncRegistryEntry } from '@/types/avSync'
import { isSyncableAttrKey } from '@/constants/avSync'

/** `renderAttributeView` 响应中索引构建所需的最小视图。 */
export interface AvRenderData {
  view?: {
    columns?: any[]
    rows?: any[]
  }
}

/**
 * 从渲染载荷构建索引。
 *
 * 列映射优先级：登记表 `entry.mapping[keyID]` → 列名本身即 `custom-` 属性名（回退，
 * 记入 `derived` 供登记表吸收）。主键列取第一个 `type === 'block'` 的列。
 */
export function buildAvIndexFromView(avID: string, entry: AvSyncRegistryEntry, data: AvRenderData): { index: AvIndex, derived: Record<string, string> } {
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

  return { index, derived }
}

/** 行插入 op 的增量维护：游离 src 进游离集合，绑定 src 建立双向映射。 */
export function seedAvIndexFromSrcs(index: AvIndex, srcs: Array<{ id?: string, itemID?: string, isDetached?: boolean }>): void {
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

/** 行删除 op 的增量维护：双向映射、游离集合与单元格缓存一并清理。 */
export function dropAvIndexRows(index: AvIndex, rowIDs: string[]): void {
  for (const rowID of rowIDs) {
    const blockID = index.rowToBlock.get(rowID)
    if (blockID)
      index.blockToRow.delete(blockID)
    index.rowToBlock.delete(rowID)
    index.detachedRowIds.delete(rowID)
    index.rowCells.delete(rowID)
  }
}
