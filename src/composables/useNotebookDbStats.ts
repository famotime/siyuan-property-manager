import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { getBlockInfo, sql, renderAttributeView } from '@/api'
import { selectStatsSeedId } from './attrStatsSql'
import { resolveDocumentBlock } from './useDocCustomStats'
import { attrStatsDebug, attrStatsError } from '@/utils/logger'

export interface DbStatsInfo {
  id: string
  name: string
  fields: string
  rowsCount: number
  blocksCount: number
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

function formatSiyuanTime(timeStr?: string | number): string {
  if (!timeStr) return '-'
  const str = String(timeStr)
  if (str.length === 14) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)} ${str.slice(8, 10)}:${str.slice(10, 12)}:${str.slice(12, 14)}`
  }
  if (str.length === 13) {
    const date = new Date(Number(str))
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  }
  return str
}

export function useNotebookDbStats(rootIdRef: Ref<string | null>, blockIdRef?: Ref<string | null>) {
  const dbList = ref<DbStatsInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const sortBy = ref<'name' | 'rows' | 'blocks'>('name')
  const sortOrder = ref<'asc' | 'desc'>('asc')

  const bindingBlocksCache = ref<Record<string, BindingBlockInfo[] | 'loading'>>({})

  async function load() {
    const rootId = selectStatsSeedId(rootIdRef.value, blockIdRef?.value)
    if (!rootId) {
      dbList.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const docBlock = await resolveDocumentBlock(rootId, blockIdRef?.value)
      const info = docBlock.box ? null : await getBlockInfo(docBlock.id)
      const boxId = docBlock.box ?? info?.box

      if (!boxId) {
        dbList.value = []
        return
      }

      // 1. 获取当前笔记本中所有的 'av' 属性视图块
      const avBlocks = await sql(`
        SELECT id, name, content, ial, markdown, created, updated, root_id, path, hpath
        FROM blocks
        WHERE type = 'av' AND box = '${boxId}'
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

            if (primaryColIdx !== -1) {
              for (const row of rows) {
                const cell = row.cells?.[primaryColIdx]
                if (cell) {
                  const val = cell.value || {}
                  if (val.block?.id) {
                    bindingBlockIds.push(String(val.block.id))
                  }
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
            created: formatSiyuanTime(avBlock.created),
            updated: formatSiyuanTime(avBlock.updated),
            bindingBlockIds: [],
            rawCreated: avBlock.created || '',
            rawUpdated: avBlock.updated || '',
          })
        }
      }

      dbList.value = result
    } catch (err: any) {
      attrStatsError('Load notebook database stats failed', err)
      error.value = err?.message ?? 'Query failed'
      dbList.value = []
    } finally {
      loading.value = false
    }
  }

  // 点击展开时，懒加载绑定块的详细信息
  async function loadBindingBlocks(avID: string, blockIds: string[]) {
    if (bindingBlocksCache.value[avID] && bindingBlocksCache.value[avID] !== 'loading') {
      return
    }

    if (blockIds.length === 0) {
      bindingBlocksCache.value[avID] = []
      return
    }

    bindingBlocksCache.value[avID] = 'loading'
    try {
      const idsPlaceholder = blockIds.map(id => `'${id}'`).join(',')
      const rows = await sql(`
        SELECT id, root_id, hpath, content, type
        FROM blocks
        WHERE id IN (${idsPlaceholder})
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
          id: id,
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

  // 排序逻辑
  const sortedDbList = computed(() => {
    const list = [...dbList.value]
    const multiplier = sortOrder.value === 'asc' ? 1 : -1

    list.sort((a, b) => {
      if (sortBy.value === 'name') {
        const nameA = a.name.toLowerCase()
        const nameB = b.name.toLowerCase()
        return nameA.localeCompare(nameB) * multiplier
      }
      if (sortBy.value === 'rows') {
        return (a.rowsCount - b.rowsCount) * multiplier
      }
      if (sortBy.value === 'blocks') {
        return (a.blocksCount - b.blocksCount) * multiplier
      }
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
