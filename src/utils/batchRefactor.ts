import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import type { AttrStatGroup } from '@/composables/useSharedStats'
import { isAttrNameIgnored } from '@/utils/attrStatsFilter'

export type RefactorScope = 'key' | 'value'
export type KeyMatchMode = 'exact' | 'prefix' | 'contains' | 'regex'
export type ValueOpMode = 'merge' | 'replace'

export interface KeyRefactorItem {
  oldKey: string
  newKey: string
  shortOld: string
  shortNew: string
  blockCount: number
  hasConflict: boolean
  isIgnored?: boolean
}

export interface KeyRefactorPlan {
  valid: boolean
  items: KeyRefactorItem[]
  invalidKeys: string[]
  ignoredCount: number
  conflictCount: number
}

export interface ValueRefactorItem {
  attrName: string
  shortAttrName: string
  oldValue: string
  newValue: string
  blockCount: number
  isIgnored?: boolean
}

export interface ValueRefactorPlan {
  valid: boolean
  items: ValueRefactorItem[]
  ignoredCount: number
}

export interface KeyRefactorOptions {
  isRegex?: boolean
  matchCase?: boolean
  ignoreRegexes?: RegExp[]
  excludeIgnored?: boolean
}

export interface ValueReplaceOptions {
  isRegex?: boolean
  matchCase?: boolean
  ignoreRegexes?: RegExp[]
  excludeIgnored?: boolean
}

/**
 * 规划属性名批量重构（默认关键词包含匹配，支持正则、精确、前缀替换）
 */
export function planKeyRefactor(
  groupsList: AttrStatGroup[],
  searchPattern: string,
  replaceText: string,
  matchMode: KeyMatchMode = 'contains',
  options: KeyRefactorOptions = {},
): KeyRefactorPlan {
  const { isRegex = false, matchCase = false, ignoreRegexes = [], excludeIgnored = true } = options
  const effectiveIsRegex = isRegex || matchMode === 'regex'

  const cleanOld = (searchPattern.startsWith(CUSTOM_KEY_PREFIX)
    ? searchPattern.slice(CUSTOM_KEY_PREFIX.length)
    : searchPattern).trim()
  const cleanNew = (replaceText.startsWith(CUSTOM_KEY_PREFIX)
    ? replaceText.slice(CUSTOM_KEY_PREFIX.length)
    : replaceText).trim()

  if (!cleanOld) {
    return { valid: false, items: [], invalidKeys: [], ignoredCount: 0, conflictCount: 0 }
  }

  // 预编译正则（如果启用正则）
  let regex: RegExp | null = null
  if (effectiveIsRegex) {
    try {
      regex = new RegExp(cleanOld, matchCase ? 'g' : 'gi')
    }
    catch {
      return { valid: false, items: [], invalidKeys: [], ignoredCount: 0, conflictCount: 0 }
    }
  }

  const existingKeys = new Set(groupsList.map(g => g.name))
  const items: KeyRefactorItem[] = []
  const invalidKeys: string[] = []
  let ignoredCount = 0
  let conflictCount = 0

  for (const group of groupsList) {
    if (!group.name.startsWith(CUSTOM_KEY_PREFIX))
      continue

    const suffix = group.name.slice(CUSTOM_KEY_PREFIX.length)
    const isIgnored = ignoreRegexes.length > 0 && isAttrNameIgnored(group.name, ignoreRegexes)

    if (isIgnored) {
      ignoredCount++
      if (excludeIgnored)
        continue
    }

    let isMatch = false
    let newSuffix = suffix

    if (effectiveIsRegex && regex) {
      regex.lastIndex = 0
      if (regex.test(suffix)) {
        isMatch = true
        regex.lastIndex = 0
        newSuffix = suffix.replace(regex, cleanNew)
      }
    }
    else if (matchMode === 'exact') {
      const isTarget = matchCase
        ? suffix === cleanOld
        : suffix.toLowerCase() === cleanOld.toLowerCase()
      if (isTarget) {
        isMatch = true
        newSuffix = cleanNew
      }
    }
    else if (matchMode === 'prefix') {
      const hasPrefix = matchCase
        ? suffix.startsWith(cleanOld)
        : suffix.toLowerCase().startsWith(cleanOld.toLowerCase())
      if (hasPrefix) {
        isMatch = true
        newSuffix = cleanNew + suffix.slice(cleanOld.length)
      }
    }
    else {
      // 默认 contains / 关键词匹配
      const hasContains = matchCase
        ? suffix.includes(cleanOld)
        : suffix.toLowerCase().includes(cleanOld.toLowerCase())
      if (hasContains) {
        isMatch = true
        if (matchCase) {
          newSuffix = suffix.replaceAll(cleanOld, cleanNew)
        }
        else {
          const esc = cleanOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          newSuffix = suffix.replace(new RegExp(esc, 'gi'), cleanNew)
        }
      }
    }

    if (!isMatch || newSuffix === suffix)
      continue

    if (!isValidCustomSuffix(newSuffix)) {
      invalidKeys.push(newSuffix)
      continue
    }

    const newKey = `${CUSTOM_KEY_PREFIX}${newSuffix}`
    const hasConflict = newKey !== group.name && existingKeys.has(newKey)
    if (hasConflict)
      conflictCount++

    const blockCount = group.values.reduce(
      (sum, v) => sum + ((v as any).blocks_count ?? v.count ?? 1),
      0,
    )

    items.push({
      oldKey: group.name,
      newKey,
      shortOld: suffix,
      shortNew: newSuffix,
      blockCount,
      hasConflict,
      isIgnored,
    })
  }

  return {
    valid: true,
    items,
    invalidKeys,
    ignoredCount,
    conflictCount,
  }
}

/**
 * 规划属性值多值合并 (Value Merge)
 */
export function planValueMerge(
  groupsList: AttrStatGroup[],
  targetAttrName: string,
  selectedOldValues: string[],
  newValue: string,
): ValueRefactorPlan {
  if (!targetAttrName || !selectedOldValues || selectedOldValues.length === 0) {
    return { valid: false, items: [], ignoredCount: 0 }
  }

  const group = groupsList.find(g => g.name === targetAttrName)
  if (!group) {
    return { valid: false, items: [], ignoredCount: 0 }
  }

  const trimmedNew = newValue.trim()
  const shortAttrName = targetAttrName.startsWith(CUSTOM_KEY_PREFIX)
    ? targetAttrName.slice(CUSTOM_KEY_PREFIX.length)
    : targetAttrName

  const items: ValueRefactorItem[] = []
  const oldValSet = new Set(selectedOldValues)

  for (const v of group.values) {
    if (oldValSet.has(v.value) && v.value !== trimmedNew) {
      items.push({
        attrName: targetAttrName,
        shortAttrName,
        oldValue: v.value,
        newValue: trimmedNew,
        blockCount: (v as any).blocks_count ?? v.count ?? 1,
      })
    }
  }

  return {
    valid: true,
    items,
    ignoredCount: 0,
  }
}

/**
 * 规划属性值查找替换 (Value Replace)
 */
export function planValueReplace(
  groupsList: AttrStatGroup[],
  targetAttrName: string | null | undefined,
  searchValue: string,
  replaceValue: string,
  options: ValueReplaceOptions = {},
): ValueRefactorPlan {
  const { isRegex = false, matchCase = false, ignoreRegexes = [], excludeIgnored = true } = options

  if (!searchValue) {
    return { valid: false, items: [], ignoredCount: 0 }
  }

  let regex: RegExp | null = null
  if (isRegex) {
    try {
      regex = new RegExp(searchValue, matchCase ? 'g' : 'gi')
    }
    catch {
      return { valid: false, items: [], ignoredCount: 0 }
    }
  }

  const items: ValueRefactorItem[] = []
  let ignoredCount = 0

  const targetGroups = targetAttrName
    ? groupsList.filter(g => g.name === targetAttrName)
    : groupsList.filter(g => g.name.startsWith(CUSTOM_KEY_PREFIX))

  for (const group of targetGroups) {
    const isIgnored = ignoreRegexes.length > 0 && isAttrNameIgnored(group.name, ignoreRegexes)
    if (isIgnored) {
      ignoredCount++
      if (excludeIgnored)
        continue
    }

    const shortAttrName = group.name.startsWith(CUSTOM_KEY_PREFIX)
      ? group.name.slice(CUSTOM_KEY_PREFIX.length)
      : group.name

    for (const v of group.values) {
      let isMatch = false
      let calculatedNew = v.value

      if (isRegex && regex) {
        regex.lastIndex = 0
        if (regex.test(v.value)) {
          isMatch = true
          regex.lastIndex = 0
          calculatedNew = v.value.replace(regex, replaceValue)
        }
      }
      else {
        const hasMatch = matchCase
          ? v.value.includes(searchValue)
          : v.value.toLowerCase().includes(searchValue.toLowerCase())
        if (hasMatch) {
          isMatch = true
          if (matchCase) {
            calculatedNew = v.value.replaceAll(searchValue, replaceValue)
          }
          else {
            const esc = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            calculatedNew = v.value.replace(new RegExp(esc, 'gi'), replaceValue)
          }
        }
      }

      if (isMatch && calculatedNew !== v.value) {
        items.push({
          attrName: group.name,
          shortAttrName,
          oldValue: v.value,
          newValue: calculatedNew,
          blockCount: (v as any).blocks_count ?? v.count ?? 1,
          isIgnored,
        })
      }
    }
  }

  return {
    valid: true,
    items,
    ignoredCount,
  }
}
