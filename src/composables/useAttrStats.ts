import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { getBlockInfo, getBlockKramdown, setBlockAttrs, sql } from '@/api'
import { buildBlocksByAttrValueQuery, buildDocBlockByAttrIdQuery, buildDocBlockByIalIdQuery, buildNotebookAttrStatsQuery, buildNotebookAttrTotalQuery, collectCustomAttrGroups, extractDocCustomId, isCustomAttrRow, mergeCurrentDocAttrRows } from './attrStatsSql'

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

async function resolveDocumentBlock(rootId: string, blockId?: string | null): Promise<ResolvedDocumentBlock> {
  try {
    const info = await getBlockInfo(rootId)
    if (info?.rootID)
      return { id: info.rootID, box: info.box }
    return { id: rootId, box: info?.box }
  }
  catch {
    const queryId = blockId ?? rootId
    const attrRows = await sql(buildDocBlockByAttrIdQuery(queryId))
    const attrRow = attrRows[0]
    if (attrRow?.root_id)
      return { id: attrRow.root_id }

    const rows = await sql(buildDocBlockByIalIdQuery(queryId))
    const row = rows[0]
    if (row?.id)
      return { id: row.root_id ?? row.id, box: row.box }

    try {
      const kramdown = await getBlockKramdown(queryId)
      return { id: extractDocCustomId(kramdown?.kramdown ?? '') ?? rootId }
    }
    catch {
      return { id: rootId }
    }
  }
}

/** 查询当前文档中包含自定义属性的块（通过 attributes 表） */
export function useDocCustomBlocks(rootIdRef: Ref<string | null>, blockIdRef?: Ref<string | null>) {
  const blocks = ref<DocBlockWithAttrs[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const rootId = rootIdRef.value ?? blockIdRef?.value
    if (!rootId) {
      blocks.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const docBlockId = (await resolveDocumentBlock(rootId, blockIdRef?.value)).id
      // 1. 查当前文档中所有含 custom-* 属性的 block_id
      const attrRows = await sql(`
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

      // 2. 批量查块内容
      const ids = [...attrMap.keys()].map(id => `'${id}'`).join(',')
      const blockRows = await sql(`
        SELECT id, content, type, root_id FROM blocks
        WHERE id IN (${ids})
        ORDER BY sort
      `)

      const result: DocBlockWithAttrs[] = []
      for (const row of blockRows) {
        const attrs = attrMap.get(row.id)
        if (!attrs || attrs.length === 0) continue
        result.push({
          id: row.id,
          content: truncate(row.content ?? '', 10),
          type: row.type ?? '',
          rootId: row.root_id ?? docBlockId,
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
    const rootId = rootIdRef.value ?? blockIdRef?.value
    if (!rootId) {
      groups.value = []
      totalBlocks.value = 0
      return
    }
    loading.value = true
    error.value = null
    try {
      const docBlock = await resolveDocumentBlock(rootId, blockIdRef?.value)
      const info = docBlock.box ? null : await getBlockInfo(docBlock.id)
      const boxId = docBlock.box ?? info?.box
      if (!boxId) {
        groups.value = []
        totalBlocks.value = 0
        return
      }

      // 按属性名和值分组统计
      const rows = await sql(buildNotebookAttrStatsQuery(boxId, [docBlock.id]))
      const docAttrRows = await sql(`
        SELECT a.name AS key, a.value
        FROM attributes a
        WHERE a.root_id = '${docBlock.id}' AND a.name LIKE 'custom-%'
        ORDER BY a.name
      `)

      // 统计含自定义属性的总块数
      const countRows = await sql(buildNotebookAttrTotalQuery(boxId, [docBlock.id]))
      totalBlocks.value = countRows[0]?.total ?? 0
      groups.value = collectCustomAttrGroups(mergeCurrentDocAttrRows(rows, docAttrRows))
    }
    catch (err: any) {
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
  const rows = await sql(buildBlocksByAttrValueQuery(boxId, attrName, oldValue))
  const blockIds: string[] = rows.map((r: any) => r.block_id).filter(Boolean)
  for (const bid of blockIds)
    await setBlockAttrs(bid, { [attrName]: newValue })
  return blockIds.length
}

/** 将笔记本中 attrName=oldValue 的块属性批量删除 */
export async function batchDeleteAttr(boxId: string, attrName: string, oldValue: string): Promise<number> {
  const rows = await sql(buildBlocksByAttrValueQuery(boxId, attrName, oldValue))
  const blockIds: string[] = rows.map((r: any) => r.block_id).filter(Boolean)
  for (const bid of blockIds)
    await setBlockAttrs(bid, { [attrName]: '' })
  return blockIds.length
}
