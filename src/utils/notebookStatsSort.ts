import type { AttrStatGroup } from '../composables/useSharedStats'

export type StatsSortOrder = 'asc' | 'desc'

/** 本地化名称比较（大小写不敏感），供属性组与数据库卡片排序共用。 */
export function compareLocale(a: string, b: string, order: StatsSortOrder): number {
  return a.toLowerCase().localeCompare(b.toLowerCase()) * (order === 'asc' ? 1 : -1)
}

/** 数值比较，供属性组与数据库卡片排序共用。 */
export function compareNumber(a: number, b: number, order: StatsSortOrder): number {
  return (a - b) * (order === 'asc' ? 1 : -1)
}

export function getGroupBlockCount(group: AttrStatGroup): number {
  return group.values.reduce((sum, val) => sum + val.count, 0)
}

export function sortAttrGroups(
  groups: AttrStatGroup[],
  sortBy: 'name' | 'values' | 'blocks',
  sortOrder: 'asc' | 'desc'
): AttrStatGroup[] {
  const list = [...groups]

  list.sort((a, b) => {
    if (sortBy === 'name') {
      return compareLocale(a.name, b.name, sortOrder)
    }
    else if (sortBy === 'values') {
      return compareNumber(a.values.length, b.values.length, sortOrder)
    }
    else if (sortBy === 'blocks') {
      return compareNumber(getGroupBlockCount(a), getGroupBlockCount(b), sortOrder)
    }
    return 0
  })

  return list
}
