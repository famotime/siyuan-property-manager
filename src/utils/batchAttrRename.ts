import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import type { AttrStatGroup } from '@/composables/useSharedStats'
import { planKeyRefactor } from './batchRefactor'

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
 * 规划批量属性名替换（保持对旧接口的兼容）
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

  const result = planKeyRefactor(groupsList, cleanOld, cleanNew, 'contains', { matchCase: true })
  return {
    valid: result.valid,
    items: result.items.map(item => ({
      oldKey: item.oldKey,
      newKey: item.newKey,
      shortOld: item.shortOld,
      shortNew: item.shortNew,
      blockCount: item.blockCount,
    })),
    invalidKeys: result.invalidKeys,
  }
}

export * from './batchRefactor'
