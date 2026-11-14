import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import type { AttrStatGroup } from '@/composables/useSharedStats'

export interface AttrReplacePlanItem {
  oldKey: string
  newKey: string
  shortOld: string
  shortNew: string
  blockCount: number
}

export interface AttrReplacePlan {
  valid: boolean
  items: AttrReplacePlanItem[]
  invalidKeys: string[]
}

/**
 * 规划批量属性名替换（支持完整属性名、前缀或任意部分子串替换）
 *
 * @param groupsList 当前统计的属性组列表
 * @param oldInput 用户输入的待替换文本（如 slide）
 * @param newInput 用户输入的新目标文本（如 slides）
 */
export function planBatchReplaceAttrKey(
  groupsList: AttrStatGroup[],
  oldInput: string,
  newInput: string,
): AttrReplacePlan {
  const cleanOld = (oldInput.startsWith(CUSTOM_KEY_PREFIX) ? oldInput.slice(CUSTOM_KEY_PREFIX.length) : oldInput).trim()
  const cleanNew = (newInput.startsWith(CUSTOM_KEY_PREFIX) ? newInput.slice(CUSTOM_KEY_PREFIX.length) : newInput).trim()
  if (!cleanOld || cleanOld === cleanNew) {
    return { valid: false, items: [], invalidKeys: [] }
  }

  const items: AttrReplacePlanItem[] = []
  const invalidKeys: string[] = []

  for (const group of groupsList) {
    if (!group.name.startsWith(CUSTOM_KEY_PREFIX)) continue
    const suffix = group.name.slice(CUSTOM_KEY_PREFIX.length)
    if (!suffix.includes(cleanOld)) continue

    const newSuffix = suffix.replaceAll(cleanOld, cleanNew)
    if (newSuffix === suffix) continue

    if (!isValidCustomSuffix(newSuffix)) {
      invalidKeys.push(newSuffix)
      continue
    }

    const blockCount = group.values.reduce((sum, v) => sum + ((v as any).blocks_count ?? v.count ?? 1), 0)
    items.push({
      oldKey: group.name,
      newKey: `${CUSTOM_KEY_PREFIX}${newSuffix}`,
      shortOld: suffix,
      shortNew: newSuffix,
      blockCount,
    })
  }

  return { valid: true, items, invalidKeys }
}
