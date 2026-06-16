import { AttrStatGroup } from '../composables/useSharedStats'

export function getGroupBlockCount(group: AttrStatGroup): number {
  return group.values.reduce((sum, val) => sum + val.count, 0)
}

export function sortAttrGroups(
  groups: AttrStatGroup[],
  sortBy: 'name' | 'values' | 'blocks',
  sortOrder: 'asc' | 'desc'
): AttrStatGroup[] {
  const list = [...groups]
  const orderMultiplier = sortOrder === 'asc' ? 1 : -1

  list.sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      return nameA.localeCompare(nameB) * orderMultiplier
    }
    else if (sortBy === 'values') {
      return (a.values.length - b.values.length) * orderMultiplier
    }
    else if (sortBy === 'blocks') {
      const countA = getGroupBlockCount(a)
      const countB = getGroupBlockCount(b)
      return (countA - countB) * orderMultiplier
    }
    return 0
  })

  return list
}
