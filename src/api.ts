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
