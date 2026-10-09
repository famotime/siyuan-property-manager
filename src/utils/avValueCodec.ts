import type { AttrType } from '@/types/schema'
import { isUnsyncedColumnType } from '@/constants/avSync'
import { parseMultiSelectValues, serializeMultiSelectValues } from '@/utils/typeInference'

/**
 * 块属性（IAL 字符串）⇄ 属性视图单元格值的双向编解码。
 *
 * 约定（与插件既有序列化约定一致，见 CLAUDE.md）：
 * - multi-select 以 `", "` 连接，按 `,` / `，` 解析
 * - checkbox 存字面量 `'true'` / `'false'`（解码时 `'1'` 亦视为勾选）
 * - date 存 `YYYY-MM-DD`（含时间则为 `YYYY-MM-DD HH:mm:ss`）
 * - 空串 = 删除属性（思源语义）
 *
 * 规则：**解码与编码都按 AV 列类型决定单元格形状**；Schema 类型只用于
 * IAL 字符串的分词（如 multi-select 的拆分）。列类型不具备 IAL 对应物时返回 null，
 * 表示该列不参与同步。
 *
 * 内核依据：`kernel/av/value.go` 的 Value* 结构与
 * `kernel/model/attribute_view.go:8074-8123`（`val.Type` 由列类型强制赋值）。
 */

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/

export function isBlankIalValue(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === ''
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** AV 毫秒时间戳 → IAL 字符串（本地时区）。 */
export function formatDateMsToIal(ms: number, isNotTime = true): string {
  const date = new Date(ms)
  const ymd = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  if (isNotTime)
    return ymd
  return `${ymd} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/** IAL 日期字符串 → `{ ms, isNotTime }`；无法解析返回 null。 */
export function parseIalDate(value: string): { ms: number, isNotTime: boolean } | null {
  const trimmed = String(value).trim()
  let match = DATE_ONLY_REGEX.exec(trimmed)
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    const ms = date.getTime()
    return Number.isFinite(ms) ? { ms, isNotTime: true } : null
  }
  match = DATE_TIME_REGEX.exec(trimmed)
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] ?? 0),
    )
    const ms = date.getTime()
    return Number.isFinite(ms) ? { ms, isNotTime: false } : null
  }
  return null
}

/** AV 数字 → IAL 字符串；未填时返回空串。 */
export function formatAvNumber(numberValue: any): string {
  if (!numberValue || !numberValue.isNotEmpty)
    return ''
  const content = Number(numberValue.content)
  return Number.isFinite(content) ? String(content) : ''
}

function selectContents(cellValue: any): string[] {
  const list = Array.isArray(cellValue?.mSelect) ? cellValue.mSelect : []
  return list
    .map((opt: any) => (opt?.content == null ? '' : String(opt.content)))
    .filter((content: string) => content !== '')
}

/**
 * AV 单元格值 → IAL 字符串。
 * 返回 null 表示该列类型不参与同步（调用方应跳过）。
 * 返回空串表示「清空该属性」。
 */
export function decodeAvCellToIal(columnType: string, cellValue: any): string | null {
  if (isUnsyncedColumnType(columnType))
    return null

  switch (columnType) {
    case 'text':
      return cellValue?.text?.content == null ? '' : String(cellValue.text.content)
    case 'number':
      return formatAvNumber(cellValue?.number)
    case 'date': {
      const dateValue = cellValue?.date
      if (!dateValue || !dateValue.isNotEmpty)
        return ''
      const ms = Number(dateValue.content)
      if (!Number.isFinite(ms))
        return ''
      // 未显式给出 isNotTime 时视为纯日期（与前端 IAVCellDateValue 注释一致）
      return formatDateMsToIal(ms, dateValue.isNotTime !== false)
    }
    case 'select':
      return selectContents(cellValue)[0] ?? ''
    case 'mSelect':
      return serializeMultiSelectValues(selectContents(cellValue))
    case 'checkbox':
      return cellValue?.checkbox?.checked === true ? 'true' : 'false'
    case 'url':
      return cellValue?.url?.content == null ? '' : String(cellValue.url.content)
    case 'email':
      return cellValue?.email?.content == null ? '' : String(cellValue.email.content)
    case 'phone':
      return cellValue?.phone?.content == null ? '' : String(cellValue.phone.content)
    default:
      return null
  }
}

/** 各列类型的「空单元格」表示。 */
function emptyCellFor(columnType: string): Record<string, unknown> | null {
  switch (columnType) {
    case 'text':
      return { text: { content: '' } }
    case 'number':
      return { number: { content: 0, isNotEmpty: false } }
    case 'date':
      return { date: { content: 0, isNotEmpty: false } }
    case 'select':
    case 'mSelect':
      return { mSelect: [] }
    case 'checkbox':
      return { checkbox: { checked: false } }
    case 'url':
    case 'email':
    case 'phone':
      return { [columnType]: { content: '' } }
    default:
      return null
  }
}

/**
 * IAL 字符串 → AV 单元格值（可直接作为 `batchSetAttributeViewBlockAttrs` 的 `value`）。
 * 返回 null 表示不参与同步或值不可表达（调用方应跳过并记日志）。
 */
export function encodeIalToAvCell(
  columnType: string,
  ialValue: string,
  schemaType?: AttrType,
): Record<string, unknown> | null {
  if (isUnsyncedColumnType(columnType))
    return null

  const raw = ialValue == null ? '' : String(ialValue)
  if (isBlankIalValue(raw))
    return emptyCellFor(columnType)

  const trimmed = raw.trim()

  switch (columnType) {
    case 'text':
      return { text: { content: raw } }
    case 'number': {
      const num = Number(trimmed)
      if (!Number.isFinite(num))
        return null
      return { number: { content: num, isNotEmpty: true } }
    }
    case 'date': {
      const parsed = parseIalDate(trimmed)
      if (!parsed)
        return null
      return { date: { content: parsed.ms, isNotEmpty: true, isNotTime: parsed.isNotTime } }
    }
    case 'select': {
      const values = schemaType === 'select'
        ? [trimmed]
        : parseMultiSelectValues(trimmed)
      const first = values[0]
      if (!first)
        return emptyCellFor(columnType)
      // color 留空 → 内核在新建选项时分配可见调色板颜色（kernel/model/attribute_view.go:8230-8252）
      return { mSelect: [{ content: first, color: '' }] }
    }
    case 'mSelect': {
      const values = parseMultiSelectValues(trimmed)
      if (values.length === 0)
        return emptyCellFor(columnType)
      return { mSelect: values.map(content => ({ content, color: '' })) }
    }
    case 'checkbox':
      return { checkbox: { checked: trimmed === 'true' || trimmed === '1' } }
    case 'url':
    case 'email':
    case 'phone':
      return { [columnType]: { content: trimmed } }
    default:
      return null
  }
}

/**
 * 插件的 Schema 属性类型 → 思源属性视图列类型。
 *
 * 仅覆盖有语义对应的组合：template / rollup / lineNumber / block / created / updated
 * 属 AV 内部概念，relation / mAsset 的值模型与 IAL 字符串不同，均不映射。
 */
export function avColumnTypeFromAttrType(attrType: AttrType): string {
  switch (attrType) {
    case 'number':
      return 'number'
    case 'select':
      return 'select'
    case 'multi-select':
      return 'mSelect'
    case 'date':
      return 'date'
    case 'checkbox':
      return 'checkbox'
    case 'block-ref':
    case 'text':
    default:
      return 'text'
  }
}
