import { CUSTOM_KEY_PREFIX } from '../constants/attrs'
import type { AttrStatGroup, DocBlockWithAttrs } from '../composables/useSharedStats'
import { attrStatsWarn } from './logger'

/**
 * 编译正则表达式列表：
 * - 自动忽略空行以及以 '#' 开头的注释行
 * - 语法错误时自动捕获异常并输出警告，避免界面崩溃
 * - 默认使用 'i'（不区分大小写）标志
 */
export function compileRegexPatterns(patterns: string[]): RegExp[] {
  if (!Array.isArray(patterns) || patterns.length === 0)
    return []

  const regexes: RegExp[] = []
  for (const raw of patterns) {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#'))
      continue

    try {
      regexes.push(new RegExp(trimmed, 'i'))
    }
    catch (err: any) {
      attrStatsWarn('Invalid regex pattern ignored', {
        pattern: trimmed,
        error: err?.message ?? String(err),
      })
    }
  }
  return regexes
}

/**
 * 判断属性名是否被正则列表屏蔽：
 * - 同时对显示名（去掉 custom- 前缀）和完整属性名（带 custom- 前缀）进行匹配
 * - 任一命中即判定为屏蔽
 */
export function isAttrNameIgnored(rawName: string, regexes: RegExp[]): boolean {
  if (!rawName || !regexes || regexes.length === 0)
    return false

  const rawKey = rawName.trim()
  const displayKey = rawKey.startsWith(CUSTOM_KEY_PREFIX)
    ? rawKey.slice(CUSTOM_KEY_PREFIX.length)
    : (rawKey.toLowerCase().startsWith(CUSTOM_KEY_PREFIX.toLowerCase())
      ? rawKey.slice(CUSTOM_KEY_PREFIX.length)
      : rawKey)

  for (const re of regexes) {
    if (re.test(displayKey) || re.test(rawKey))
      return true
  }
  return false
}

/**
 * 获取被正则屏蔽命中的属性分组列表（用于弹窗实时预览与数量统计）。
 */
export function getIgnoredAttrGroups(
  groups: AttrStatGroup[],
  regexes: RegExp[],
): AttrStatGroup[] {
  if (!groups || groups.length === 0 || !regexes || regexes.length === 0)
    return []

  return groups.filter(g => isAttrNameIgnored(g.name, regexes))
}

/**
 * 匹配属性名：支持按显示名（不带 custom- 前缀）或完整属性名（带 custom- 前缀）进行模糊匹配（不区分大小写，自动修剪首尾空格）。
 */
export function matchAttrName(rawName: string, query: string): boolean {
  const kw = query.trim().toLowerCase()
  if (!kw)
    return true

  const lowerRaw = rawName.toLowerCase()
  const lowerWithoutPrefix = lowerRaw.startsWith(CUSTOM_KEY_PREFIX.toLowerCase())
    ? lowerRaw.slice(CUSTOM_KEY_PREFIX.length)
    : lowerRaw

  return lowerWithoutPrefix.includes(kw) || lowerRaw.includes(kw)
}

/**
 * 筛选文档自定义属性块列表。
 * 若块中包含任一属性名匹配搜索词的自定义属性，则保留该块。
 */
export function filterDocCustomBlocks(
  blocks: DocBlockWithAttrs[],
  query: string
): DocBlockWithAttrs[] {
  const kw = query.trim()
  if (!kw)
    return blocks

  return blocks.filter(block =>
    block.attrs.some(attr => matchAttrName(attr.key, kw))
  )
}

/**
 * 筛选笔记本自定义属性统计分组列表。
 * 若传入 ignoreRegexes，先过滤掉命中屏蔽规则的分组；
 * 然后再根据搜索词保留匹配的分组。
 */
export function filterNotebookAttrGroups(
  groups: AttrStatGroup[],
  query: string,
  ignoreRegexes?: RegExp[],
): AttrStatGroup[] {
  const baseGroups = ignoreRegexes && ignoreRegexes.length > 0
    ? groups.filter(group => !isAttrNameIgnored(group.name, ignoreRegexes))
    : groups

  const kw = query.trim()
  if (!kw)
    return baseGroups

  return baseGroups.filter(group => matchAttrName(group.name, kw))
}
