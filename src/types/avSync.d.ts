/** 属性 ⇄ 数据库（属性视图）双向同步的类型定义。 */

export type AvSyncMode = 'bidirectional' | 'av-to-attr' | 'attr-to-av'

export type AvSyncStatusState = 'idle' | 'syncing' | 'done' | 'error'

export interface AvSyncStatus {
  state: AvSyncStatusState
  /** 本次同步写入的项数。 */
  written?: number
  /** 本次同步跳过的项数（值相同 / 不可表达 / 游离行）。 */
  skipped?: number
  message?: string
  at?: number
}

/** 单个数据库的同步登记项。 */
export interface AvSyncRegistryEntry {
  avID: string
  /** 数据库名，仅用于 UI 展示。 */
  name: string
  enabled: boolean
  /** AV 列 keyID → 块属性全名（如 `custom-status`）。列名被改名后仍能对上。 */
  mapping: Record<string, string>
  updatedAt: number
}

export interface AvSyncStorage {
  version: number
  entries: Record<string, AvSyncRegistryEntry>
}

/** AV 的一列在同步语境下的视图。 */
export interface AvColumn {
  keyID: string
  /** 列名（原样）。 */
  name: string
  /** AV 列类型（`kernel/av/av.go` 的 KeyType）。 */
  type: string
  /** 映射到的块属性全名；null 表示该列不参与同步。 */
  attrKey: string | null
}

/** 单个 avID 的行/列映射缓存。 */
export interface AvIndex {
  avID: string
  builtAt: number
  /** 主键（block）列的 keyID。 */
  blockKeyID: string | null
  columns: Map<string, AvColumn>
  byAttrKey: Map<string, AvColumn>
  /** itemID（行记录 ID）→ 绑定块 ID。游离行不在其中。 */
  rowToBlock: Map<string, string>
  /** 绑定块 ID → itemID。 */
  blockToRow: Map<string, string>
  /** 游离行 itemID（未绑定任何块）。 */
  detachedRowIds: Set<string>
  /** 与 `rowCells` 顺序对齐的列数组，供按需对账使用。 */
  columnOrder: AvColumn[]
  /** itemID → 原始行单元格数组（与 `columnOrder` 顺序对齐）。 */
  rowCells: Map<string, any[]>
  /** 需要重新构建。 */
  stale: boolean
}

// ---- 从 ws-main op 归一化出来的事件 ----

export interface AvCellEvent {
  kind: 'cell'
  avID: string
  blockID: string
  keyID: string
  rowID: string
  data: any
}

export interface AvCellsEvent {
  kind: 'cells'
  avID: string
  blockID: string
  updates: Array<{ keyID: string, rowID: string, data: any }>
}

export interface AvRowsInsertEvent {
  kind: 'rows-insert'
  avID: string
  blockID: string
  srcs: Array<{ id?: string, itemID?: string, isDetached?: boolean }>
}

export interface AvRowsRemoveEvent {
  kind: 'rows-remove'
  avID: string
  blockID: string
  srcIDs: string[]
}

export interface AvStructuralEvent {
  kind: 'structural'
  avID: string
  blockID: string
  action: string
}

export type AvSyncEvent
  = | AvCellEvent
    | AvCellsEvent
    | AvRowsInsertEvent
    | AvRowsRemoveEvent
    | AvStructuralEvent

/** 从 `updateAttrs` op 中提取出的块属性变更。 */
export interface AttrChangeEvent {
  blockID: string
  /** 真正发生变化的可同步属性（值已为变更后的值；删除表现为空串）。 */
  changed: Record<string, string>
  /** op 携带的全量新属性映射（内核 side 保证完整）。 */
  next: Record<string, string>
}
