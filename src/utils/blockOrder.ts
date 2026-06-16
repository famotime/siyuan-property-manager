export interface SyTreeNode {
  ID?: string
  Properties?: {
    id?: string
  }
  Children?: SyTreeNode[]
}

export function buildSyTreeOrderMap(root: SyTreeNode): Map<string, number> {
  const orderMap = new Map<string, number>()
  let cursor = 0
  const walk = (node?: SyTreeNode) => {
    if (!node || typeof node !== 'object') {
      return
    }
    const id = (node.ID || node.Properties?.id || '').trim()
    if (id && !orderMap.has(id)) {
      orderMap.set(id, cursor)
      cursor += 1
    }
    const children = Array.isArray(node.Children) ? node.Children : []
    children.forEach((child) => walk(child))
  }
  walk(root)
  return orderMap
}

export function sortBlocksByDocOrder(
  blockIds: string[],
  allDocBlocks: { id: string, parent_id?: string | null, sort?: number | string | null }[],
  docBlockId: string
): string[] {
  const allIdsSet = new Set(allDocBlocks.map(row => row.id))
  
  // 附加原始物理索引 index 以实现稳定排序 (Stable Sort)
  const parentToChildren = new Map<string, { id: string, sort: number, index: number }[]>()
  
  allDocBlocks.forEach((row, index) => {
    const pid = row.parent_id || ''
    if (!parentToChildren.has(pid)) {
      parentToChildren.set(pid, [])
    }
    parentToChildren.get(pid)!.push({
      id: row.id,
      sort: Number(row.sort ?? 0),
      index
    })
  })
  
  // 稳定排序：先比 sort，若相同则比原始 rowid 物理插入顺序
  for (const [_, children] of parentToChildren) {
    children.sort((a, b) => {
      if (a.sort !== b.sort) {
        return a.sort - b.sort
      }
      return a.index - b.index
    })
  }
  
  // 识别所有的顶级内容块 (树根)
  // 排除文档块本身，如果一个节点没有父节点，或者 parent_id === docBlockId，或者其 parent_id 没在当前文档块中出现过，它就是顶级节点
  const roots: { id: string, sort: number, index: number }[] = []
  allDocBlocks.forEach((row, index) => {
    if (row.id === docBlockId) {
      return
    }
    const pid = row.parent_id || ''
    if (!pid || pid === docBlockId || !allIdsSet.has(pid)) {
      roots.push({
        id: row.id,
        sort: Number(row.sort ?? 0),
        index
      })
    }
  })
  
  // 顶级节点也根据稳定排序排序
  roots.sort((a, b) => {
    if (a.sort !== b.sort) {
      return a.sort - b.sort
    }
    return a.index - b.index
  })
  
  const orderedIds: string[] = []
  const targetSet = new Set(blockIds)
  
  const dfs = (nodeId: string) => {
    if (targetSet.has(nodeId)) {
      orderedIds.push(nodeId)
    }
    const children = parentToChildren.get(nodeId)
    if (children) {
      for (const child of children) {
        dfs(child.id)
      }
    }
  }
  
  // 从每个顶级节点顺次向下执行 DFS 深度优先前序遍历
  for (const r of roots) {
    dfs(r.id)
  }
  
  const visited = new Set(orderedIds)
  for (const id of blockIds) {
    if (!visited.has(id)) {
      orderedIds.push(id)
    }
  }
  
  return orderedIds
}
