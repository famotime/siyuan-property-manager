import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { getBlockInfo, sql, renderAttributeView } from '@/api'
import { selectStatsSeedId } from './attrStatsSql'
import { resolveDocumentBlock } from './useDocCustomStats'
import { sqlLiteral } from '@/utils/sqlLiteral'
import { attrStatsError } from '@/utils/logger'
import { formatSiyuanTime } from '@/utils/dom'
import { compareLocale, compareNumber } from '@/utils/notebookStatsSort'

export interface DbStatsInfo {
  id: string
  name: string
  fields: string
  rowsCount: number
  blocksCount: number
  /** 未绑定任何块的行数（游离行），这些行不参与属性双向同步。 */
  detachedCount: number
  created: string
  updated: string
  bindingBlockIds: string[]
  rawCreated: string
  rawUpdated: string
}

export interface BindingBlockInfo {
  id: string
  rootId: string
  hpath: string
  content: string
  type: string
  isFallback?: boolean
}

export function useNotebookDbStats(rootIdRef: Ref<string | null>, blockIdRef?: Ref<string | null>) {
  const dbList = ref<DbStatsInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const sortBy = ref<'name' | 'rows' | 'blocks'>('name')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  const bindingBlocksCache = ref<Record<string, BindingBlockInfo[] | 'loading'>>({})

  // 单调递增加载标记：快速切换文档时丢弃过期响应（SM-104，与 useBlockAttrs 一致）
  let loadToken = 0

  async function load() {
    const rootId = selectStatsSeedId(rootIdRef.value, blockIdRef?.value)
    if (!rootId) {
      loadToken++
      dbList.value = []
      error.value = null
      loading.value = false
      return
    }

    const token = ++loadToken
    loading.value = true
    error.value = null

    try {
      const docBlock = await resolveDocumentBlock(rootId, blockIdRef?.value)
      const info = docBlock.box ? null : await getBlockInfo(docBlock.id)
      const boxId = docBlock.box ?? info?.box

      if (token !== loadToken)
        return
      if (!boxId) {
        dbList.value = []
        return
      }

      // 1. 获取当前笔记本中所有的 'av' 属性视图块（仅取后续用到的列）
      const avBlocks = await sql(`
        SELECT id, markdown, created, updated
        FROM blocks
        WHERE type = 'av' AND box = ${sqlLiteral(boxId)}
        LIMIT 9999
      `)

      const result: DbStatsInfo[] = []

      // 2. 遍历获取每个属性视图的实际渲染数据以精确统计行数与绑定块数
      for (const avBlock of avBlocks) {
        if (!avBlock?.id) continue

        // 关键修正：属性视图块的 Block ID 和真正的 avID 不同，avID 记录在 markdown 的 data-av-id 属性中
        const match = String(avBlock.markdown || '').match(/data-av-id="([^"]+)"/)
        const avID = match?.[1] || avBlock.id

        try {
          const avData = await renderAttributeView(avID)
          if (avData) {
            const view = avData.view || {}
            const rowsCount = view.rowCount ?? 0
            const columns = Array.isArray(view.columns) ? view.columns : []
            const fields = columns.map((c: any) => String(c.name || '').trim()).filter(Boolean).join('、')

            const primaryColIdx = columns.findIndex((c: any) => c.type === 'block')
            const rows = Array.isArray(view.rows) ? view.rows : []
            const bindingBlockIds: string[] = []
            // 主键列的 isDetached 才是可信的游离标记（kernel/model/attribute_view.go:8266-8290）
            let detachedCount = 0

            if (primaryColIdx !== -1) {
              for (const row of rows) {
                const val = row.cells?.[primaryColIdx]?.value || {}
                const boundBlockId = val.block?.id ? String(val.block.id) : ''
                if (boundBlockId && val.isDetached !== true) {
                  bindingBlockIds.push(boundBlockId)
                }
                else {
                  detachedCount++
                }
              }
            }

            const blocksCount = bindingBlockIds.length
            // 获取数据库名称仅使用 avData.name，若为空则显示空以让前端回退展示未命名数据库 (不要回退到 view.name，如“表格”)
            const dbName = String(avData.name || '').trim()

            result.push({
              id: avID,
              name: dbName,
              fields,
              rowsCount,
              blocksCount,
              detachedCount,
              created: formatSiyuanTime(avBlock.created),
              updated: formatSiyuanTime(avBlock.updated),
              bindingBlockIds,
              rawCreated: avBlock.created || '',
              rawUpdated: avBlock.updated || '',
            })
          } else {
            // 保底数据
            result.push({
              id: avID,
              name: '',
              fields: '',
              rowsCount: 0,
              blocksCount: 0,
              detachedCount: 0,
              created: formatSiyuanTime(avBlock.created),
              updated: formatSiyuanTime(avBlock.updated),
              bindingBlockIds: [],
              rawCreated: avBlock.created || '',
              rawUpdated: avBlock.updated || '',
            })
          }
        } catch (apiErr) {
          attrStatsError(`Failed to render AV ${avID}`, apiErr)
          result.push({
            id: avID,
            name: '',
            fields: '',
            rowsCount: 0,
            blocksCount: 0,
            detachedCount: 0,
            created: formatSiyuanTime(avBlock.created),
            updated: formatSiyuanTime(avBlock.updated),
            bindingBlockIds: [],
            rawCreated: avBlock.created || '',
            rawUpdated: avBlock.updated || '',
          })
        }
      }

      if (token !== loadToken)
        return
      dbList.value = result
    } catch (err: any) {
      if (token !== loadToken)
        return
      attrStatsError('Load notebook database stats failed', err)
      error.value = err?.message ?? 'Query failed'
      dbList.value = []
    } finally {
      if (token === loadToken)
        loading.value = false
    }
  }

  // 点击展开时，懒加载绑定块的详细信息；任意已缓存状态（含 'loading'）直接返回，
  // 避免 loading 期间重复请求（SM-115）
  async function loadBindingBlocks(avID: string, blockIds: string[]) {
    if (bindingBlocksCache.value[avID] !== undefined) {
      return
    }

    if (blockIds.length === 0) {
      bindingBlocksCache.value[avID] = []
      return
    }

    bindingBlocksCache.value[avID] = 'loading'
    try {
      const idsPlaceholder = blockIds.map(sqlLiteral).join(',')
      const rows = await sql(`
        SELECT id, root_id, hpath, content, type
        FROM blocks
        WHERE id IN (${idsPlaceholder})
        LIMIT 9999
      `)

      const rowMap = new Map<string, any>()
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (r?.id) rowMap.set(String(r.id), r)
        }
      }

      const results: BindingBlockInfo[] = blockIds.map(id => {
        const row = rowMap.get(id)
        return {
          id,
          rootId: row?.root_id || id,
          hpath: row?.hpath || '',
          content: row?.content || '',
          type: row?.type || '',
          isFallback: !row,
        }
      })

      bindingBlocksCache.value[avID] = results
    } catch (err) {
      attrStatsError(`Failed to query binding blocks for AV ${avID}`, err)
      const fallbackResults: BindingBlockInfo[] = blockIds.map(id => ({
        id,
        rootId: id,
        hpath: '',
        content: '',
        type: '',
        isFallback: true,
      }))
      bindingBlocksCache.value[avID] = fallbackResults
    }
  }

  // 排序逻辑（比较器来自已测试的 notebookStatsSort）
  const sortedDbList = computed(() => {
    const list = [...dbList.value]

    list.sort((a, b) => {
      if (sortBy.value === 'name')
        return compareLocale(a.name, b.name, sortOrder.value)
      if (sortBy.value === 'rows')
        return compareNumber(a.rowsCount, b.rowsCount, sortOrder.value)
      if (sortBy.value === 'blocks')
        return compareNumber(a.blocksCount, b.blocksCount, sortOrder.value)
      return 0
    })

    return list
  })

  watch([rootIdRef, blockIdRef ?? ref(null)], () => {
    bindingBlocksCache.value = {}
    load()
  }, { immediate: true })

  return {
    dbList: sortedDbList,
    loading,
    error,
    sortBy,
    sortOrder,
    bindingBlocksCache,
    loadBindingBlocks,
    reload: load,
  }
}
