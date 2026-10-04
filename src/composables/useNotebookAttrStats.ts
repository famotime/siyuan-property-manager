import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { getBlockInfo, setBlockAttrs } from '../api'
import { attrStatsDebug, attrStatsError, attrStatsWarn } from '../utils/logger'
import { buildBlocksByAttrValueQuery, buildBlocksInfoByAttrValueQuery, buildNotebookAttrStatsQuery, buildNotebookAttrTotalQuery, collectCustomAttrGroups, selectStatsSeedId } from './attrStatsSql'
import { resolveDocumentBlock } from './useDocCustomStats'
import { runStatsSql, AttrStatGroup } from './useSharedStats'

export interface BlockInfoByAttr {
  id: string
  content: string
  root_id: string
  type: string
  hpath: string
}

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

      const rows = await runStatsSql('notebook-attr-stats', buildNotebookAttrStatsQuery(boxId, [docBlock.id]))
      const docAttrRows = await runStatsSql<{ key?: string, value?: string | null }>('current-doc-custom-attrs', `
        SELECT a.name AS key, a.value
        FROM attributes a
        WHERE (a.root_id = '${docBlock.id}' OR a.block_id = '${docBlock.id}') AND a.name LIKE 'custom-%'
        LIMIT 9999
      `)
      
      const docCustomMap = new Map<string, Set<string>>()
      for (const row of docAttrRows) {
        if (!row.key || !row.value) continue
        if (!docCustomMap.has(row.key)) docCustomMap.set(row.key, new Set())
        docCustomMap.get(row.key)!.add(row.value)
      }

      groups.value = collectCustomAttrGroups(rows, docCustomMap)

      const totalRow = await runStatsSql<{ total?: number }>('notebook-attr-total', buildNotebookAttrTotalQuery(boxId))
      totalBlocks.value = Number(totalRow[0]?.total ?? 0)
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

export async function getBlocksByAttrValue(boxId: string, attrName: string, attrValue: string): Promise<BlockInfoByAttr[]> {
  try {
    return await runStatsSql<BlockInfoByAttr>('blocks-by-attr-val', buildBlocksInfoByAttrValueQuery(boxId, attrName, attrValue))
  }
  catch (err: any) {
    attrStatsWarn('getBlocksByAttrValue failed', { attrName, attrValue, error: err?.message ?? String(err) })
    return []
  }
}

export async function batchEditAttr(boxId: string, attrName: string, oldValue: string, newValue: string): Promise<number> {
  const rows = await runStatsSql<{ block_id?: string }>('batch-edit-query', buildBlocksByAttrValueQuery(boxId, attrName, oldValue))
  const bIds = rows.map(r => r.block_id).filter(Boolean) as string[]
  if (bIds.length === 0) return 0
  await setBlockAttrs(bIds, { [attrName]: newValue })
  return bIds.length
}

export async function batchDeleteAttr(boxId: string, attrName: string, value: string): Promise<number> {
  const rows = await runStatsSql<{ block_id?: string }>('batch-delete-query', buildBlocksByAttrValueQuery(boxId, attrName, value))
  const bIds = rows.map(r => r.block_id).filter(Boolean) as string[]
  if (bIds.length === 0) return 0
  await setBlockAttrs(bIds, { [attrName]: '' })
  return bIds.length
}
