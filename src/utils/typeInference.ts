import type { AttrType } from '@/types/schema'

const SIYUAN_BLOCK_ID_REGEX = /^\d{14}-[a-z0-9]{7}$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/
const NUMERIC_REGEX = /^-?\d+(?:\.\d+)?$/

/**
 * 启发式推导属性的数据类型。
 *
 * 优先根据现有取值的格式特征进行识别；
 * 当值为空时，结合键名语义特征进行推测；
 * 最终兜底为 'text'。
 */
export function inferAttrType(key: string, value: string): AttrType {
  const trimmedVal = value?.trim() ?? ''
  const lowerKey = key.toLowerCase()

  // 1. 根据当前值特征推导
  if (trimmedVal) {
    if (trimmedVal === 'true' || trimmedVal === 'false')
      return 'checkbox'

    if (SIYUAN_BLOCK_ID_REGEX.test(trimmedVal))
      return 'block-ref'

    if (ISO_DATE_REGEX.test(trimmedVal))
      return 'date'

    if (NUMERIC_REGEX.test(trimmedVal))
      return 'number'

    if (trimmedVal.includes(',') || trimmedVal.includes('，'))
      return 'multi-select'
  }

  // 2. 根据属性键名后缀/特征推测（支持匹配中缀与后缀，如 is_active 或 active_date）
  if (/(?:[-_](?:date|time|deadline|at)$|[-_](?:date|time|deadline|at)[-_])/.test(lowerKey))
    return 'date'

  if (/(?:[-_](?:status|state|priority|level|stage|category)$|[-_](?:status|state|priority|level|stage|category)[-_])/.test(lowerKey))
    return 'select'

  if (/(?:[-_](?:tags|labels|categories|keywords)$|[-_](?:tags|labels|categories|keywords)[-_])/.test(lowerKey))
    return 'multi-select'

  if (/(?:[-_](?:count|num|price|score|rating|age|amount)$|[-_](?:count|num|price|score|rating|age|amount)[-_])/.test(lowerKey))
    return 'number'

  if (/(?:[-_](?:is|has|enable|disabled|done|checked)$|[-_](?:is|has|enable|disabled|done|checked)[-_])/.test(lowerKey))
    return 'checkbox'

  if (/(?:[-_](?:ref|block|target|parent_id|doc_id)$|[-_](?:ref|block|target|parent_id|doc_id)[-_])/.test(lowerKey))
    return 'block-ref'

  return 'text'
}

/**
 * 解析多选属性字符串为标签数组
 */
export function parseMultiSelectValues(raw: string): string[] {
  if (!raw || typeof raw !== 'string')
    return []
  return raw
    .split(/[,，]/)
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * 将多选标签数组序列化为标准存储字符串（以英文逗号加空格分隔）
 */
export function serializeMultiSelectValues(values: string[]): string {
  if (!Array.isArray(values) || values.length === 0)
    return ''
  return values.map(s => s.trim()).filter(Boolean).join(', ')
}
