/**
 * 属性 ⇄ 数据库（属性视图 / Attribute View）双向同步的常量。
 *
 * 设计背景与内核依据见 `docs/属性与数据库双向同步方案与实施计划.md`。
 */

export const AV_SYNC_STORAGE_NAME = 'av-sync.json'

export const AV_SYNC_STORAGE_VERSION = 1

/** 未显式配置时的同步方向。 */
export const DEFAULT_AV_SYNC_MODE = 'bidirectional' as const

// ---- AV op action ----

export const AV_OP_UPDATE_CELL = 'updateAttrViewCell'
export const AV_OP_UPDATE_CELLS = 'updateAttrViewCells'
export const AV_OP_INSERT_BLOCK = 'insertAttrViewBlock'
export const AV_OP_REMOVE_BLOCK = 'removeAttrViewBlock'

/**
 * 结构性 op：会改变行列拓扑，命中后需让 AvIndex 失效。
 * 其余 action 含 `attrview` 的 op 也会被当作结构性变更（保守失效）。
 */
export const AV_STRUCTURAL_ACTIONS = new Set<string>([
  'addAttrViewCol',
  'removeAttrViewCol',
  'updateAttrViewCol',
  'updateAttrViewColOptions',
  'updateAttrViewColOption',
  'removeAttrViewColOption',
  'setAttrViewColOptionDesc',
  'sortAttrViewCol',
  'sortAttrViewKey',
  'sortAttrViewRow',
  'sortAttrViewBinding',
  'updateAttrViewColWidth',
  'setAttrViewColWrap',
  'setAttrViewColHidden',
  'setAttrViewColPin',
  'setAttrViewColIcon',
  'setAttrViewColDesc',
  'setAttrViewColAlign',
  'setAttrViewFilters',
  'setAttrViewContextFilter',
  'setAttrViewColRelationFilters',
  'setAttrViewColRollupFilters',
  'setAttrViewSorts',
  'setAttrViewPageSize',
  'setAttrViewCustomColors',
  'setAttrViewColCalc',
])

// ---- 属性键过滤 ----

/** 内核维护的绑定标记等键，即使带 `custom-` 前缀也不参与属性同步。 */
export const AV_RESERVED_ATTR_KEYS = new Set<string>([
  'custom-avs',
  'av-names',
])

/** 内核保留前缀（`custom-sy-av-s-text-<avID>` 等）。 */
export const AV_RESERVED_ATTR_PREFIXES = ['custom-sy-av-'] as const

/**
 * 判断某个块属性是否可参与同步。
 * 必须是 `custom-<suffix>` 且不在内核保留键/前缀之内。
 */
export function isSyncableAttrKey(key: string): boolean {
  if (!key || !key.startsWith('custom-'))
    return false
  if (AV_RESERVED_ATTR_KEYS.has(key))
    return false
  return !AV_RESERVED_ATTR_PREFIXES.some(prefix => key.startsWith(prefix))
}

/** 不参与值同步的 AV 列类型（主键列另有用途，仅用于行↔块映射）。 */
export const AV_UNSYNCED_COLUMN_TYPES = new Set<string>([
  'block',
  'created',
  'updated',
  'template',
  'rollup',
  'lineNumber',
  'relation',
  'mAsset',
])

export function isUnsyncedColumnType(columnType: string): boolean {
  return AV_UNSYNCED_COLUMN_TYPES.has(columnType)
}

// ---- 运行时参数 ----

/** AvIndex 缓存有效期；期间结构未变则不重新 render。 */
export const AV_INDEX_TTL_MS = 5 * 60 * 1000

/** 单元格变更合并防抖（同一 avID+keyID+rowID 只保留最后一次）。 */
export const AV_CELL_DEBOUNCE_MS = 120

/** 属性变更合并防抖（同一 blockID+avID+attrKey 只保留最后一次）。 */
export const AV_ATTR_DEBOUNCE_MS = 120

/** 回声令牌有效期：由 AV 引发的 IAL 写入，在该窗口内不再回写 AV。 */
export const AV_ECHO_TOKEN_TTL_MS = 2000

/** 单个冲刷窗口内的写入次数上限，防止极端环路耗电。 */
export const AV_SYNC_WRITE_BUDGET = 200

/** 面板属性变更后，供 UI 立即刷新的自定义事件（与既有链路共用）。 */
export const AV_SPM_ATTRS_CHANGED_EVENT = 'spm:attrs-changed'
