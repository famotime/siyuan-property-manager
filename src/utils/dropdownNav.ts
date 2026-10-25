/**
 * 下拉联想控件的纯导航/过滤逻辑。
 *
 * 供 AttrTypeSelect / AttrTypeMultiSelect / AddCustomRow 等控件收敛重复实现，
 * 不依赖 Vue 渲染，可独立单测。
 */

/** 高亮索引循环移动；total 为 0 时原样返回。 */
export function cycleIndex(index: number, total: number, delta: number): number {
  if (total <= 0)
    return index
  return (index + delta + total) % total
}

/** 按 label/value 双字段大小写不敏感过滤选项。 */
export function filterOptionsByQuery<T extends { label: string, value: string }>(options: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return options
  return options.filter(o =>
    o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
  )
}

/** 按子串大小写不敏感过滤字符串列表。 */
export function filterStringsByQuery(list: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q)
    return list
  return list.filter(v => v.toLowerCase().includes(q))
}

/** 查询串是否可「新建为选项」：非空且未与现有 label/value 重复。 */
export function canCreateOptionValue<T extends { label: string, value: string }>(options: T[], query: string): boolean {
  const q = query.trim()
  if (!q)
    return false
  return !options.some(o => o.value.toLowerCase() === q.toLowerCase() || o.label.toLowerCase() === q.toLowerCase())
}

export interface FlatIndexLayout {
  optionCount: number
  canCreate: boolean
  historyCount: number
}

export type FlatIndexTarget
  = | { kind: 'option', index: number }
    | { kind: 'create' }
    | { kind: 'history', index: number }
    | { kind: 'none' }

/**
 * 扁平高亮索引的三段解析：选项区 → 新建区 → 历史区。
 * 与渲染顺序一致：`filteredOptions` +（可选）新建项 + `filteredHistory`。
 */
export function resolveFlatIndex(highlightIndex: number, layout: FlatIndexLayout): FlatIndexTarget {
  const createBase = layout.optionCount
  const historyBase = layout.optionCount + (layout.canCreate ? 1 : 0)
  if (highlightIndex >= 0 && highlightIndex < layout.optionCount)
    return { kind: 'option', index: highlightIndex }
  if (layout.canCreate && highlightIndex === createBase)
    return { kind: 'create' }
  const historyIndex = highlightIndex - historyBase
  if (historyIndex >= 0 && historyIndex < layout.historyCount)
    return { kind: 'history', index: historyIndex }
  return { kind: 'none' }
}
