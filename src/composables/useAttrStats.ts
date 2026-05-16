import type { Ref } from 'vue'
import { ref, watch } from 'vue'
import { sql } from '@/api'

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

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** 解析 SQL 返回的 ial 字符串，如 '{: custom-status="done" custom-priority="high" }' */
function parseIal(ial: string | null | undefined): { key: string, value: string }[] {
  if (!ial) return []
  const result: { key: string, value: string }[] = []
  const re = /([a-zA-Z0-9_-]+)="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(ial)) !== null) {
    if (m[1].startsWith('custom-'))
      result.push({ key: m[1], value: m[2] })
  }
  return result
}

export function useDocCustomBlocks(rootIdRef: Ref<string | null>) {
  const blocks = ref<DocBlockWithAttrs[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const rootId = rootIdRef.value
    if (!rootId) {
      blocks.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const rows = await sql(`
        SELECT b.id, b.content, b.type, b.root_id, b.ial
        FROM blocks b
        WHERE b.root_id = '${rootId}'
          AND b.ial LIKE '%custom-%'
        ORDER BY b.sort
      `)
      const result: DocBlockWithAttrs[] = []
      for (const row of rows) {
        const attrs = parseIal(row.ial)
        if (attrs.length === 0) continue
        result.push({
          id: row.id,
          content: truncate(row.content ?? '', 10),
          type: row.type ?? '',
          rootId: row.root_id ?? rootId,
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

  watch(rootIdRef, () => load(), { immediate: true })

  return { blocks, loading, error, reload: load }
}

export function useNotebookAttrStats(boxIdRef: Ref<string | null>) {
  const groups = ref<AttrStatGroup[]>([])
  const totalBlocks = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const boxId = boxIdRef.value
    if (!boxId) {
      groups.value = []
      totalBlocks.value = 0
      return
    }
    loading.value = true
    error.value = null
    try {
      const rows = await sql(`
        SELECT a.name, a.value, COUNT(DISTINCT a.block_id) AS cnt
        FROM attributes a
        WHERE a.box = '${boxId}'
          AND a.name LIKE 'custom-%'
        GROUP BY a.name, a.value
        ORDER BY a.name, cnt DESC
      `)
      const groupMap = new Map<string, AttrStatValue[]>()
      for (const row of rows) {
        const name: string = row.name
        const value: string = row.value ?? ''
        const count: number = row.cnt ?? 0
        if (!groupMap.has(name))
          groupMap.set(name, [])
        groupMap.get(name)!.push({ value, count })
      }
      // 重新查询总块数（避免重复计数）
      const countRows = await sql(`
        SELECT COUNT(DISTINCT a.block_id) AS total
        FROM attributes a
        WHERE a.box = '${boxId}'
          AND a.name LIKE 'custom-%'
      `)
      totalBlocks.value = countRows[0]?.total ?? 0

      const result: AttrStatGroup[] = []
      for (const [name, values] of groupMap) {
        result.push({ name, values })
      }
      groups.value = result
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

  watch(boxIdRef, () => load(), { immediate: true })

  return { groups, totalBlocks, loading, error, reload: load }
}
