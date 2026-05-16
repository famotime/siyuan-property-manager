import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { getBlockInfo, getBlockKramdown, setBlockAttrs, sql } from '@/api'
import { attrStatsDebug, attrStatsError, attrStatsWarn } from '@/utils/logger'
import { buildBlocksByAttrValueQuery, buildDocBlockByAttrIdQuery, buildDocBlockByIalIdQuery, buildNotebookAttrStatsQuery, buildNotebookAttrTotalQuery, collectCustomAttrGroups, extractDocCustomId, isCustomAttrRow, mergeCurrentDocAttrRows, normalizeSqlRows, selectStatsSeedId } from './attrStatsSql'

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

      // 2. 批量查块内容
      const ids = [...attrMap.keys()].map(id => `'${id}'`).join(',')
      const blockRows = await runStatsSql<{ id?: string, content?: string, type?: string, root_id?: string }>('doc-custom-blocks', `
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
