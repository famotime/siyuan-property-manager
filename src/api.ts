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

export async function sql(stmt: string): Promise<any[]> {
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

export async function searchBlocksByKeyword(query: string, limit = 20): Promise<Array<{ id: string, content: string, type: string }>> {
  if (!query.trim())
    return []
  const escaped = query.replace(/'/g, "''")
  return sql(`SELECT id, content, type FROM blocks WHERE content LIKE '%${escaped}%' ORDER BY updated DESC LIMIT ${limit}`)
}

export async function getBlockContent(id: string): Promise<string> {
  if (!id)
    return ''
  const rows = await sql(`SELECT content FROM blocks WHERE id = '${id}' LIMIT 1`)
  return rows[0]?.content ?? ''
}


