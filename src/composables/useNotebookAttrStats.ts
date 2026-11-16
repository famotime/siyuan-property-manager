import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { getBlockInfo, setBlockAttrs } from '@/api'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import { attrStatsDebug, attrStatsWarn } from '@/utils/logger'
import { sqlLiteral } from '@/utils/sqlLiteral'
import { buildBlocksByAttrNameQuery, buildBlocksByAttrValueQuery, buildBlocksInfoByAttrValueQuery, buildNotebookAttrStatsQuery, buildNotebookAttrTotalQuery, collectCustomAttrGroups, mergeCurrentDocAttrRows, selectStatsSeedId } from './attrStatsSql'
import { resolveDocumentBlock } from './useDocCustomStats'
import { runStatsSql, AttrStatGroup } from './useSharedStats'

export interface BlockInfoByAttr {
  id: string
  content: string
  root_id: string
  type: string
  hpath: string
  [key: string]: unknown
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
        WHERE (a.root_id = ${sqlLiteral(docBlock.id)} OR a.block_id = ${sqlLiteral(docBlock.id)}) AND a.name LIKE 'custom-%'
        LIMIT 9999
      `)

      // 当前文档的属性并入统计行：笔记本查询遗漏的（name, value）以 cnt=1 补入
      const mergedRows = mergeCurrentDocAttrRows(rows, docAttrRows)
      groups.value = collectCustomAttrGroups(mergedRows)

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

/**
 * 逐块写入并分片并发。
 *
 * 内核 `/api/attr/setBlockAttrs` 的 id 契约是单个字符串（apicontract.SetBlockAttrsRequest），
 * 不接受数组，必须逐块写入；分片可避免命中 9999 块时对内核瞬间打出上千个并发请求。
 */
const BATCH_WRITE_CHUNK_SIZE = 25

async function writeBlocksInChunks(
  targets: Array<{ id: string, attrs: Record<string, string> }>,
): Promise<number> {
  let ok = 0
  for (let i = 0; i < targets.length; i += BATCH_WRITE_CHUNK_SIZE) {
    const chunk = targets.slice(i, i + BATCH_WRITE_CHUNK_SIZE)
    const results = await Promise.allSettled(chunk.map(t => setBlockAttrs(t.id, t.attrs)))
    ok += results.filter(r => r.status === 'fulfilled').length
  }
  return ok
}

export async function batchEditAttr(boxId: string, attrName: string, oldValue: string, newValue: string): Promise<number> {
  const rows = await runStatsSql<{ block_id?: string }>('batch-edit-query', buildBlocksByAttrValueQuery(boxId, attrName, oldValue))
  const bIds = rows.map(r => r.block_id).filter(Boolean) as string[]
  if (bIds.length === 0) return 0
  return writeBlocksInChunks(bIds.map(id => ({ id, attrs: { [attrName]: newValue } })))
}

export async function batchDeleteAttr(boxId: string, attrName: string, value: string): Promise<number> {
  const rows = await runStatsSql<{ block_id?: string }>('batch-delete-query', buildBlocksByAttrValueQuery(boxId, attrName, value))
  const bIds = rows.map(r => r.block_id).filter(Boolean) as string[]
  if (bIds.length === 0) return 0
  return writeBlocksInChunks(bIds.map(id => ({ id, attrs: { [attrName]: '' } })))
}

export function normalizeCustomAttrKey(rawKey: string): string | null {
  const trimmed = rawKey.trim()
  if (!trimmed) return null
  const suffix = trimmed.startsWith(CUSTOM_KEY_PREFIX) ? trimmed.slice(CUSTOM_KEY_PREFIX.length) : trimmed
  if (!suffix || !isValidCustomSuffix(suffix)) return null
  return `${CUSTOM_KEY_PREFIX}${suffix}`
}

export async function batchRenameAttrKey(boxId: string, oldAttrName: string, newAttrName: string): Promise<number> {
  const oldKey = normalizeCustomAttrKey(oldAttrName)
  const newKey = normalizeCustomAttrKey(newAttrName)
  if (!oldKey || !newKey || oldKey === newKey) return 0
  const rows = await runStatsSql<{ block_id?: string, value?: string | null }>('batch-rename-key-query', buildBlocksByAttrNameQuery(boxId, oldKey))
  const validRows = rows.filter(r => Boolean(r.block_id)) as { block_id: string, value?: string | null }[]
  if (validRows.length === 0) return 0
  return writeBlocksInChunks(validRows.map(r => ({
    id: r.block_id,
    attrs: { [newKey]: r.value ?? '', [oldKey]: '' },
  })))
}
