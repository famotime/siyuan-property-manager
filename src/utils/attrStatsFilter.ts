import { CUSTOM_KEY_PREFIX } from '../constants/attrs'
import type { AttrStatGroup, DocBlockWithAttrs } from '../composables/useSharedStats'

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
 * 若分组属性名匹配搜索词，则保留该分组。
 */
export function filterNotebookAttrGroups(
  groups: AttrStatGroup[],
  query: string
): AttrStatGroup[] {
  const kw = query.trim()
  if (!kw)
    return groups

  return groups.filter(group => matchAttrName(group.name, kw))
}
