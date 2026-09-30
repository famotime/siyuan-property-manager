/**
 * 思源内核 API 封装 — 仅包含本插件实际使用的接口。
 *
 * @see https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md
 */

import { fetchSyncPost, IWebSocketData } from 'siyuan'

async function request(url: string, data: any) {
  const response: IWebSocketData = await fetchSyncPost(url, data)
  const res = response.code === 0 ? response.data : null
  return res
}

// ---- Block ----

export async function getBlockKramdown(
  id: BlockId,
): Promise<IResGetBlockKramdown> {
  return request('/api/block/getBlockKramdown', { id })
}

export async function getBlockInfo(id: BlockId): Promise<{ box?: string, rootID?: string, path?: string, type?: string }> {
  return request('/api/block/getBlockInfo', { id })
}

// ---- Attributes ----

export async function setBlockAttrs(
  id: BlockId,
  attrs: { [key: string]: string },
) {
  return request('/api/attr/setBlockAttrs', { id, attrs })
}

export async function getBlockAttrs(
  id: BlockId,
): Promise<{ [key: string]: string }> {
  return request('/api/attr/getBlockAttrs', { id })
}

// ---- SQL ----

type QueryRunner = (stmt: string) => Promise<any[]>
let customQueryRunner: QueryRunner | null = null

export function setCustomQueryRunner(runner: QueryRunner | null) {
  customQueryRunner = runner
}

export async function sql(stmt: string): Promise<any[]> {
  if (customQueryRunner)
    return customQueryRunner(stmt)
  const result = await request('/api/query/sql', { stmt })
  return Array.isArray(result) ? result : []
}

export async function getPathByID(id: BlockId): Promise<{ notebook?: string, path?: string } | null> {
  return request('/api/filetree/getPathByID', { id })
}

export async function getFile(path: string): Promise<any | null> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const token = (window as any).siyuan?.config?.apiToken
    if (token) {
      headers['Authorization'] = `Token ${token}`
    }
    const response = await fetch('/api/file/getFile', {
      method: 'POST',
      headers,
      body: JSON.stringify({ path }),
    })
    if (!response.ok) {
      return null
    }
    const text = await response.text()
    if (!text.trim()) {
      return null
    }
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      if (parsed.code === 0 && parsed.data !== undefined) {
        return parsed.data
      }
      if (parsed.code !== undefined && parsed.code !== 0) {
        return null
      }
      return parsed
    }
    return null
  } catch {
    return null
  }
}

// ---- Attribute View (Database) ----

export async function renderAttributeView(id: string, pageSize = 9999): Promise<any> {
  return request('/api/av/renderAttributeView', { id, pageSize })
}

export async function insertBlock(params: {
  dataType: 'markdown' | 'dom'
  data: string
  nextID?: string
  previousID?: string
  parentID?: string
}): Promise<IResdoOperations | null> {
  return request('/api/block/insertBlock', params)
}

export async function addAttributeViewBlocks(params: {
  avID: string
  srcs: Array<{ id: string, isDetached: boolean }>
}): Promise<any> {
  return request('/api/av/addAttributeViewBlocks', params)
}

/**
 * 批量设置属性视图中各行各列的值。
 * 常用于绑定块后，将块已有的自定义属性值回填到数据库对应列。
 */
export async function batchSetAttributeViewBlockAttrs(params: {
  avID: string
  values: Array<{
    keyID: string
    itemID: string
    value: { text?: { content: string } } | Record<string, unknown>
  }>
}): Promise<any> {
  return request('/api/av/batchSetAttributeViewBlockAttrs', params)
}

/**
 * 通过 multipart/form-data 向思源工作空间写入文件。
 * 常用于初始化 AV JSON（`/data/storage/av/{avID}.json`）。
 */
export async function putFile(path: string, content: string): Promise<boolean> {
  try {
    const form = new FormData()
    form.append('path', path)
    // 使用 Blob 以保证 Content-Type 设为 application/json
    const blob = new Blob([content], { type: 'application/json' })
    form.append('file', blob, path.split('/').pop() ?? 'file.json')
    const response = await fetch('/api/file/putFile', {
      method: 'POST',
      body: form,
    })
    const json = await response.json()
    return json.code === 0
  } catch (err) {
    console.error('[spm] putFile 失败:', err)
    return false
  }
}

export interface BlockRefCandidate {
  id: string
  content: string
  name?: string
  type: string
  hPath?: string
  rootID?: string
}

export async function searchBlocksByKeyword(query: string, limit = 20): Promise<BlockRefCandidate[]> {
  const q = query.trim()
  try {
    const res = await request('/api/search/searchRefBlock', {
      k: q,
      isSquareBrackets: true,
      beforeLen: 32,
      rootID: '',
    })
    if (res && Array.isArray(res.blocks) && res.blocks.length > 0) {
      return res.blocks.slice(0, limit).map((b: any) => ({
        id: b.id,
        content: (b.content || b.name || '').replace(/<[^>]+>/g, ''),
        name: (b.name || '').replace(/<[^>]+>/g, ''),
        type: b.type,
        hPath: b.hPath,
        rootID: b.rootID,
      }))
    }
  }
  catch {
    // 降级使用 SQL 查询
  }

  // 降级或单元测试环境：使用 SQL 检索，优先排序列出文档 (type = 'd')
  const escaped = q.replace(/'/g, "''")
  const whereClause = escaped
    ? `WHERE content LIKE '%${escaped}%' OR name LIKE '%${escaped}%' OR hpath LIKE '%${escaped}%'`
    : ''
  return sql(
    `SELECT id, content, name, type, hpath AS hPath, root_id AS rootID FROM blocks ${whereClause} ORDER BY CASE WHEN type = 'd' THEN 0 ELSE 1 END, updated DESC LIMIT ${limit}`,
  )
}

export async function getBlockRefInfo(id: string): Promise<BlockRefCandidate | null> {
  if (!id)
    return null
  try {
    const rows = await sql(
      `SELECT id, content, name, type, hpath AS hPath, root_id AS rootID FROM blocks WHERE id = '${id}' LIMIT 1`,
    )
    if (rows && rows.length > 0) {
      return rows[0]
    }
  }
  catch {
    // 忽略异常
  }
  return null
}

export async function getBlockContent(id: string): Promise<string> {
  if (!id)
    return ''
  const rows = await sql(`SELECT content, name, type FROM blocks WHERE id = '${id}' LIMIT 1`)
  if (!rows || rows.length === 0)
    return ''
  const row = rows[0]
  return row.type === 'd' ? (row.content || row.name || '') : (row.content || '')
}


