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

export interface NotebookDocStat {
  rootId: string
  title: string
  blockCount: number
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/** 解析 ial 字符串中的 custom-* 属性 */
function parseCustomAttrs(ial: string | null | undefined): { key: string, value: string }[] {
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
        const attrs = parseCustomAttrs(row.ial)
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
  const docs = ref<NotebookDocStat[]>([])
  const totalBlocks = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    const boxId = boxIdRef.value
    if (!boxId) {
      docs.value = []
      totalBlocks.value = 0
      return
    }
    loading.value = true
    error.value = null
    try {
      // 查询每个文档中含自定义属性的块数（排除文档块自身）
      const rows = await sql(`
        SELECT b.root_id, COUNT(*) AS cnt
        FROM blocks b
        WHERE b.box = '${boxId}'
          AND b.ial LIKE '%custom-%'
          AND b.type != 'd'
        GROUP BY b.root_id
        ORDER BY cnt DESC
      `)

      const docStats: NotebookDocStat[] = []
      let total = 0
      for (const row of rows) {
        const rootId: string = row.root_id
        const count: number = row.cnt ?? 0
        total += count
        docStats.push({ rootId, title: '', blockCount: count })
      }

      // 批量获取文档标题
      if (docStats.length > 0) {
        const ids = docStats.map(d => `'${d.rootId}'`).join(',')
        const titleRows = await sql(`
          SELECT id, content FROM blocks
          WHERE id IN (${ids}) AND type = 'd'
        `)
        const titleMap = new Map<string, string>()
        for (const tr of titleRows)
          titleMap.set(tr.id, tr.content ?? '')
        for (const d of docStats)
          d.title = titleMap.get(d.rootId) || d.rootId
      }

      docs.value = docStats
      totalBlocks.value = total
    }
    catch (err: any) {
      error.value = err?.message ?? 'Query failed'
      docs.value = []
      totalBlocks.value = 0
    }
    finally {
      loading.value = false
    }
  }

  watch(boxIdRef, () => load(), { immediate: true })

  return { docs, totalBlocks, loading, error, reload: load }
}
