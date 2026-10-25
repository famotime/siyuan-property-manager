/**
 * AV 同步登记表（`av-sync.json`）的纯序列化/归一化/合并逻辑。
 *
 * 从 `useAvSync.ts` 原样抽出的 kernel-free 部分，供引擎与单元测试共用。
 * 行为契约见 `docs/属性与数据库双向同步方案与实施计划.md`。
 */

import type { AvSyncRegistryEntry } from '@/types/avSync'
import { isSyncableAttrKey } from '@/constants/avSync'

/** 序列化为键排序后的 JSON，保证「内容相同 ⇔ 串相同」以便写入去重。 */
export function serializeAvSyncEntries(value: Record<string, AvSyncRegistryEntry>): string {
  const sorted: Record<string, AvSyncRegistryEntry> = {}
  for (const key of Object.keys(value).sort())
    sorted[key] = value[key]
  return JSON.stringify(sorted)
}

/** 容错归一化：丢弃非对象条目、缺 avID 的条目与不可同步的映射值。 */
export function normalizeAvSyncEntries(raw: any): Record<string, AvSyncRegistryEntry> {
  const result: Record<string, AvSyncRegistryEntry> = {}
  if (!raw || typeof raw !== 'object')
    return result
  for (const avID of Object.keys(raw)) {
    const item = raw[avID]
    if (!item || typeof item !== 'object' || !avID)
      continue
    const mapping: Record<string, string> = {}
    if (item.mapping && typeof item.mapping === 'object') {
      for (const keyID of Object.keys(item.mapping)) {
        const attrKey = item.mapping[keyID]
        if (typeof attrKey === 'string' && isSyncableAttrKey(attrKey))
          mapping[keyID] = attrKey
      }
    }
    result[avID] = {
      avID,
      name: typeof item.name === 'string' ? item.name : '',
      enabled: item.enabled === true,
      mapping,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
    }
  }
  return result
}

/**
 * 把从列名推断出的映射并入已有映射。
 * 无任何变化时返回 null（调用方据此跳过持久化，避免无谓的跨端广播）。
 */
export function mergeAvSyncMappings(existing: Record<string, string>, derived: Record<string, string>): Record<string, string> | null {
  const keys = Object.keys(derived)
  if (keys.length === 0)
    return null
  let changed = false
  const mapping = { ...existing }
  for (const keyID of keys) {
    if (mapping[keyID] === derived[keyID])
      continue
    mapping[keyID] = derived[keyID]
    changed = true
  }
  return changed ? mapping : null
}
