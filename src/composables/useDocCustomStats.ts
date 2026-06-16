import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { getBlockInfo, getBlockKramdown, getPathByID, getFile } from '../api'
import { attrStatsDebug, attrStatsWarn } from '../utils/logger'
import { buildDocBlockByAttrIdQuery, buildDocBlockByIalIdQuery, extractDocCustomId, isCustomAttrRow, selectStatsSeedId } from './attrStatsSql'
import { buildSyTreeOrderMap, sortBlocksByDocOrder, SyTreeNode } from '../utils/blockOrder'
import { DocBlockWithAttrs, runStatsSql, truncate } from './useSharedStats'

export interface ResolvedDocumentBlock {
  id: string
  box?: string
}

export async function resolveDocumentBlock(rootId: string, blockId?: string | null): Promise<ResolvedDocumentBlock> {
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
      // 1. 查当前文档中所有含 custom-* 属性的 block_id（包括文档本身）
      const attrRows = await runStatsSql<{ block_id?: string, name?: string, value?: string | null }>('doc-custom-attrs', `
        SELECT a.block_id, a.name, a.value
        FROM attributes a
        WHERE (a.root_id = '${docBlockId}' OR a.block_id = '${docBlockId}') AND a.name LIKE 'custom-%'
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
          rootId: row.root_id ?? '',
        })
      }

      // 4. 组装结果（保持排序后的顺序）
      const result: DocBlockWithAttrs[] = []
      for (const bid of orderedIds) {
        const b = blockMap.get(bid)
        const attrs = attrMap.get(bid)
        if (b && attrs) {
          result.push({
            id: bid,
            content: b.content,
            type: b.type,
            rootId: b.rootId || docBlockId, // 若 rootId 为空，回退至当前文档 ID
            attrs,
          })
        }
      }

      blocks.value = result
    }
    catch (err: any) {
      error.value = String(err)
      attrStatsWarn('load doc custom blocks error', { error: err })
    }
    finally {
      loading.value = false
    }
  }

  watch([rootIdRef, blockIdRef ?? ref(null)], () => load(), { immediate: true })

  return {
    blocks,
    loading,
    error,
    load,
  }
}
