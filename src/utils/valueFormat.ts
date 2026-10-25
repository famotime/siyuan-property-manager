/**
 * Schema 展示格式化：date / number 属性的只读渲染格式。
 *
 * 约定：编辑态永远保存规范原始值（数字为十进制字符串、日期为 YYYY-MM-DD[ HH:mm[:ss]]），
 * dateFormat / numberFormat 只影响展示态，不参与存储与同步。
 */

export type NumberFormatKind = 'number' | 'currency' | 'percent'

const NUMBER_RE = /^-?\d+(\.\d+)?$/

/** 千分位分组整数部分。 */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 数字属性展示格式化：
 * - undefined / 非法数字 → 原样返回；
 * - 'number' → 千分位分组；
 * - 'currency' → ¥ 前缀 + 千分位；
 * - 'percent' → % 后缀 + 千分位。
 */
export function formatNumberDisplay(value: string, format: NumberFormatKind | undefined): string {
  const trimmed = value.trim()
  if (format === undefined || !trimmed || !NUMBER_RE.test(trimmed))
    return value

  const negative = trimmed.startsWith('-')
  const raw = negative ? trimmed.slice(1) : trimmed
  const [intPart, fracPart] = raw.split('.')
  const grouped = groupThousands(intPart) + (fracPart ? `.${fracPart}` : '')
  const signed = negative ? `-${grouped}` : grouped

  if (format === 'percent')
    return `${signed}%`
  if (format === 'currency')
    return `¥${signed}`
  return signed
}

const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/

/**
 * 日期属性展示格式化：
 * - 无 format 或值不匹配规范格式 → 原样返回；
 * - format 含 HH 而值本身不含时间 → 原样返回（不凭空补 00:00）；
 * - format 不含 HH 而值含时间 → 仅展示日期部分。
 */
export function formatDateDisplay(value: string, format: string | undefined): string {
  const trimmed = value.trim()
  if (!format || !trimmed)
    return value

  const match = trimmed.match(DATETIME_RE)
  if (!match)
    return value

  const [, y, mo, d, hh] = match
  const wantTime = format.includes('HH')
  if (!wantTime)
    return `${y}-${mo}-${d}`
  if (!hh)
    return trimmed
  return trimmed
}
