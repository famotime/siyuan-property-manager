import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { getBlockInfo, getBlockKramdown, setBlockAttrs, sql, getPathByID, getFile } from '@/api'
import { attrStatsDebug, attrStatsError, attrStatsWarn } from '@/utils/logger'
import { buildBlocksByAttrValueQuery, buildBlocksInfoByAttrValueQuery, buildDocBlockByAttrIdQuery, buildDocBlockByIalIdQuery, buildNotebookAttrStatsQuery, buildNotebookAttrTotalQuery, collectCustomAttrGroups, extractDocCustomId, isCustomAttrRow, mergeCurrentDocAttrRows, normalizeSqlRows, selectStatsSeedId } from './attrStatsSql'

export interface DocBlockWithAttrs {
  id: string
  content: string
  type: string
  rootId: string
  attrs: { key: string, value: string }[]
}

export interface AttrStatValue {
  value: string
  count: number
}

export interface AttrStatGroup {
  name: string
  values: AttrStatValue[]
}

interface ResolvedDocumentBlock {
  id: string
  box?: string
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

async function runStatsSql<T extends Record<string, unknown>>(label: string, stmt: string): Promise<T[]> {
  attrStatsDebug('SQL start', { label, stmt })
  const rawRows = await sql(stmt)
  const rows = normalizeSqlRows<T>(rawRows, label)
  attrStatsDebug('SQL result', {
    label,
    rawType: rawRows === null ? 'null' : typeof rawRows,
    isArray: Array.isArray(rawRows),
    rowCount: rows.length,
    sample: rows.slice(0, 3),
  })
  return rows
}

async function resolveDocumentBlock(rootId: string, blockId?: string | null): Promise<ResolvedDocumentBlock> {
  attrStatsDebug('resolveDocumentBlock start', { rootId, blockId })
  try {
    const info = await getBlockInfo(rootId)
    attrStatsDebug('getBlockInfo result', { rootId, info })
    if (info?.rootID)
      return { id: info.rootID, box: info.box }
    return { id: rootId, box: info?.box }
  }
  catch (err: any) {
    attrStatsWarn('getBlockInfo failed, trying SQL fallback', {
      rootId,
      blockId,
      error: err?.message ?? String(err),
    })
    const queryId = blockId ?? rootId
    const attrRows = await runStatsSql<{ root_id?: string, block_id?: string }>('resolve-doc-by-attr-id', buildDocBlockByAttrIdQuery(queryId))
    const attrRow = attrRows[0]
    if (attrRow?.root_id)
      return { id: attrRow.root_id }

    const rows = await runStatsSql<{ id?: string, root_id?: string, box?: string }>('resolve-doc-by-ial-id', buildDocBlockByIalIdQuery(queryId))
    const row = rows[0]
    if (row?.id)
      return { id: row.root_id ?? row.id, box: row.box }

    try {
      const kramdown = await getBlockKramdown(queryId)
      return { id: extractDocCustomId(kramdown?.kramdown ?? '') ?? rootId }
    }
    catch (kramdownErr: any) {
      attrStatsWarn('getBlockKramdown fallback failed', {
        queryId,
        error: kramdownErr?.message ?? String(kramdownErr),
      })
      return { id: rootId }
    }
  }
}

interface SyTreeNode {
  ID?: string
  Properties?: {
    id?: string
  }
  Children?: SyTreeNode[]
}

function buildSyTreeOrderMap(root: SyTreeNode): Map<string, number> {
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

async function loadSyOrderMap(docId: string): Promise<Map<string, number> | null> {
  try {
    const pathInfo = await getPathByID(docId)
    if (!pathInfo?.notebook || !pathInfo.path) {
      return null
    }
    const notebook = pathInfo.notebook.trim()
    const docPath = pathInfo.path.trim()
    const normalizedPath = docPath.startsWith('/') ? docPath : `/${docPath}`
    const syPath = `/data/${notebook}${normalizedPath}`
    const syContent = await getFile(syPath)
    if (syContent && typeof syContent === 'object') {
      return buildSyTreeOrderMap(syContent as SyTreeNode)
    }
    return null
  } catch {
    return null
  }
}

function sortBlocksByDocOrder(
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

/** 查询当前文档中包含自定义属性的块（通过 attributes 表） */
export function useDocCustomBlocks(rootIdRef: Ref<string | null>, blockIdRef?: Ref<string | null>) {
  const blocks = ref<DocBlockWithAttrs[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const rootId = selectStatsSeedId(rootIdRef.value, blockIdRef?.value)
    if (!rootId) {
      blocks.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      attrStatsDebug('load doc custom blocks start', {
        seedId: rootId,
        rootId: rootIdRef.value,
        blockId: blockIdRef?.value ?? null,
      })
      const docBlockId = (await resolveDocumentBlock(rootId, blockIdRef?.value)).id
      // 1. 查当前文档中所有含 custom-* 属性的 block_id
      const attrRows = await runStatsSql<{ block_id?: string, name?: string, value?: string | null }>('doc-custom-attrs', `
        SELECT a.block_id, a.name, a.value
        FROM attributes a
        WHERE a.root_id = '${docBlockId}' AND a.name LIKE 'custom-%'
        ORDER BY a.block_id, a.name
      `)

      // 按 block_id 分组
      const attrMap = new Map<string, { key: string, value: string }[]>()
      for (const row of attrRows) {
        if (!isCustomAttrRow(row))
          continue
        const bid: string = row.block_id
        if (!attrMap.has(bid)) attrMap.set(bid, [])
        attrMap.get(bid)!.push({ key: row.name, value: row.value ?? '' })
      }

      if (attrMap.size === 0) {
        blocks.value = []
        return
      }

      const unorderedIds = [...attrMap.keys()]
      let orderedIds: string[] = []

      // 尝试从 .sy 物理文件读取绝对准确的文档树顺序 (同 siyuan-doc-assist 核心设计)
      const syOrderMap = await loadSyOrderMap(docBlockId)
      if (syOrderMap && syOrderMap.size > 0) {
        orderedIds = [...unorderedIds].sort((a, b) => {
          const orderA = syOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER
          const orderB = syOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER
          return orderA - orderB
        })
      } else {
        // 保底：回退到 SQLite 结构树 DFS 稳定排序
        const structRows = await runStatsSql<{ id: string, parent_id?: string | null, sort?: number | string | null }>('doc-blocks-structure', `
          SELECT id, parent_id, sort FROM blocks
          WHERE root_id = '${docBlockId}'
          ORDER BY rowid ASC
        `)
        orderedIds = sortBlocksByDocOrder(unorderedIds, structRows, docBlockId)
      }

      // 3. 批量查包含自定义属性的块内容
      const idsPlaceholder = orderedIds.map(id => `'${id}'`).join(',')
      const blockRows = await runStatsSql<{ id?: string, content?: string, type?: string, root_id?: string }>('doc-custom-blocks', `
        SELECT id, content, type, root_id FROM blocks
        WHERE id IN (${idsPlaceholder})
      `)

      const blockMap = new Map<string, { content: string, type: string, rootId: string }>()
      for (const row of blockRows) {
        if (!row.id) continue
        blockMap.set(row.id, {
          content: truncate(row.content ?? '', 10),
          type: row.type ?? '',
          rootId: row.root_id ?? docBlockId,
        })
      }

      const result: DocBlockWithAttrs[] = []
      for (const bid of orderedIds) {
        const row = blockMap.get(bid)
        if (!row) continue
        const attrs = attrMap.get(bid)
        if (!attrs || attrs.length === 0) continue
        result.push({
          id: bid,
          content: row.content,
          type: row.type,
          rootId: row.rootId,
          attrs,
        })
      }
      blocks.value = result
    }
    catch (err: any) {
      error.value = err?.message ?? 'Query failed'
      blocks.value = []
    }
    finally {
      loading.value = false
    }
  }

  watch([rootIdRef, blockIdRef ?? ref(null)], () => load(), { immediate: true })

  return { blocks, loading, error, reload: load }
}

/** 查询当前笔记本的自定义属性分组统计（通过 attributes 表） */
export function useNotebookAttrStats(rootIdRef: Ref<string | null>, blockIdRef?: Ref<string | null>) {
  const groups = ref<AttrStatGroup[]>([])
  const totalBlocks = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const rootId = selectStatsSeedId(rootIdRef.value, blockIdRef?.value)
    if (!rootId) {
      groups.value = []
      totalBlocks.value = 0
      return
    }
    loading.value = true
    error.value = null
    try {
      attrStatsDebug('load notebook stats start', {
        seedId: rootId,
        rootId: rootIdRef.value,
        blockId: blockIdRef?.value ?? null,
      })
      const docBlock = await resolveDocumentBlock(rootId, blockIdRef?.value)
      const info = docBlock.box ? null : await getBlockInfo(docBlock.id)
      const boxId = docBlock.box ?? info?.box
      attrStatsDebug('notebook stats resolved ids', {
        seedId: rootId,
        docBlock,
        info,
        boxId,
      })
      if (!boxId) {
        attrStatsWarn('notebook stats missing boxId', {
          seedId: rootId,
          docBlock,
          info,
        })
        groups.value = []
        totalBlocks.value = 0
        return
      }

      // 按属性名和值分组统计
      const rows = await runStatsSql('notebook-attr-stats', buildNotebookAttrStatsQuery(boxId, [docBlock.id]))
      const docAttrRows = await runStatsSql<{ key?: string, value?: string | null }>('current-doc-custom-attrs', `
        SELECT a.name AS key, a.value
        FROM attributes a
        WHERE a.root_id = '${docBlock.id}' AND a.name LIKE 'custom-%'
        ORDER BY a.name
      `)

      // 统计含自定义属性的总块数
      const countRows = await runStatsSql<{ total?: number }>('notebook-attr-total', buildNotebookAttrTotalQuery(boxId, [docBlock.id]))
      totalBlocks.value = countRows[0]?.total ?? 0
      groups.value = collectCustomAttrGroups(mergeCurrentDocAttrRows(rows, docAttrRows))
    }
    catch (err: any) {
      attrStatsError('load notebook stats failed', {
        seedId: rootId,
        rootId: rootIdRef.value,
        blockId: blockIdRef?.value ?? null,
        error: err?.message ?? String(err),
        stack: err?.stack,
      })
      error.value = err?.message ?? 'Query failed'
      groups.value = []
      totalBlocks.value = 0
    }
    finally {
      loading.value = false
    }
  }

  watch([rootIdRef, blockIdRef ?? ref(null)], () => load(), { immediate: true })

  return { groups, totalBlocks, loading, error, reload: load }
}

/** 将笔记本中 attrName=oldValue 的块属性批量改为 newValue */
export async function batchEditAttr(boxId: string, attrName: string, oldValue: string, newValue: string): Promise<number> {
  const raw = await sql(buildBlocksByAttrValueQuery(boxId, attrName, oldValue))
  const rows = Array.isArray(raw) ? raw : []
  const blockIds: string[] = rows.map((r: any) => r.block_id as string).filter(Boolean)
  for (const bid of blockIds) {
    try {
      await setBlockAttrs(bid, { [attrName]: newValue })
    }
    catch (err: any) {
      attrStatsError('batchEditAttr setBlockAttrs failed', { bid, attrName, error: err?.message ?? String(err) })
    }
  }
  return blockIds.length
}

/** 将笔记本中 attrName=oldValue 的块属性批量删除 */
export async function batchDeleteAttr(boxId: string, attrName: string, oldValue: string): Promise<number> {
  const raw = await sql(buildBlocksByAttrValueQuery(boxId, attrName, oldValue))
  const rows = Array.isArray(raw) ? raw : []
  const blockIds: string[] = rows.map((r: any) => r.block_id as string).filter(Boolean)
  for (const bid of blockIds) {
    try {
      await setBlockAttrs(bid, { [attrName]: '' })
    }
    catch (err: any) {
      attrStatsError('batchDeleteAttr setBlockAttrs failed', { bid, attrName, error: err?.message ?? String(err) })
    }
  }
  return blockIds.length
}

export interface BlockInfoByAttr {
  id: string
  root_id: string
  hpath: string
  content: string
  type: string
}

export async function getBlocksByAttrValue(boxId: string, attrName: string, attrValue: string): Promise<BlockInfoByAttr[]> {
  try {
    const raw = await sql(buildBlocksInfoByAttrValueQuery(boxId, attrName, attrValue))
    return Array.isArray(raw) ? (raw as BlockInfoByAttr[]) : []
  }
  catch (err: any) {
    attrStatsError('getBlocksByAttrValue failed', { boxId, attrName, attrValue, error: err?.message ?? String(err) })
    return []
  }
}

