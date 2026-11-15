/**
 * 构建含模板属性列的 AV JSON（spec=4）— 纯函数，无内核/组件依赖。
 *
 * - 第一列固定为 block 主键列；
 * - attrKeys 中每个属性名对应一个列，**列类型取自插件 Schema**（select/mSelect 另带选项池）。
 *
 * 注意：列名使用带 `custom-` 前缀的 fullKey 只是为了让「列名 ↔ 属性名」的对应关系
 * 自解释并可被同步引擎按名回退推断；**内核并不识别该前缀，也不存在「列名 → 属性名」的
 * 原生映射**（见 docs/reference/属性转数据库反向同步可行性与方案分析报告.md 第 3 节）。
 */

import type { AttrOption, AttrType } from '@/types/schema'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { generateSiyuanId } from '@/utils/siyuanId'
import { avColumnTypeFromAttrType } from '@/utils/avValueCodec'

export interface BuildAvJsonOptions {
  dbName?: string
  /** 主键列名（调用方注入 i18n 文案）。 */
  primaryKeyName: string
  /** 默认表格视图名（调用方注入 i18n 文案）。 */
  tableViewName: string
  /** Schema 类型解析（未配置时走键名启发式）。 */
  resolveType: (fullKey: string) => AttrType
  /** Schema 选项池。 */
  getOptions: (fullKey: string) => AttrOption[]
}

export interface AvJsonBuildResult {
  json: string
  /** 属性全名 → keyID。 */
  keyIdMap: Record<string, string>
  /** 属性全名 → 列类型。 */
  columnTypeMap: Record<string, string>
}

export function buildAvJsonWithAttrs(
  avID: string,
  attrKeys: string[],
  options: BuildAvJsonOptions,
): AvJsonBuildResult {
  const blockKeyId = generateSiyuanId()
  const viewId = generateSiyuanId()
  const tblId = generateSiyuanId()

  // 将每个属性 key 规范化为 custom- 前缀形式
  const normalizedKeys = attrKeys.map(k =>
    k.startsWith(CUSTOM_KEY_PREFIX) ? k : `${CUSTOM_KEY_PREFIX}${k}`,
  )

  // 为每个属性生成 ID 并建立映射
  const keyIdMap: Record<string, string> = {}
  const columnTypeMap: Record<string, string> = {}
  const attrKeyValues = normalizedKeys.map((fullKey) => {
    const id = generateSiyuanId()
    keyIdMap[fullKey] = id
    // 列类型按 Schema 推导（未配置时走键名启发式），避免全部降级为 text 导致往返丢类型
    const attrType = options.resolveType(fullKey)
    const columnType = avColumnTypeFromAttrType(attrType)
    columnTypeMap[fullKey] = columnType

    const key: Record<string, unknown> = {
      id,
      name: fullKey,
      type: columnType,
      icon: '',
      desc: '',
      numberFormat: '',
      template: '',
    }

    if (columnType === 'select' || columnType === 'mSelect') {
      const optionList = options.getOptions(fullKey) ?? []
      key.options = optionList.map((option, index) => ({
        name: option.value,
        // AV 选项颜色是 1-14 的内置调色板索引，非十六进制色值
        color: String((index % 14) + 1),
        desc: option.label ?? '',
      }))
    }

    return { key }
  })

  // 所有列（主键 + 属性列）
  const allColumns = [
    { id: blockKeyId, wrap: false, hidden: false, pin: false, width: '' },
    ...normalizedKeys.map(k => ({ id: keyIdMap[k], wrap: false, hidden: false, pin: false, width: '' })),
  ]

  const avData = {
    spec: 4,
    id: avID,
    name: options.dbName || '',
    keyValues: [
      {
        key: {
          id: blockKeyId,
          name: options.primaryKeyName,
          type: 'block',
          icon: '',
          desc: '',
          numberFormat: '',
          template: '',
        },
      },
      ...attrKeyValues,
    ],
    keyIDs: null,
    viewID: viewId,
    views: [{
      id: viewId,
      icon: '',
      name: options.tableViewName,
      hideAttrViewName: false,
      desc: '',
      pageSize: 50,
      type: 'table',
      table: {
        spec: 0,
        id: tblId,
        showIcon: true,
        wrapField: false,
        columns: allColumns,
        rowIds: null,
      },
    }],
  }
  return { json: JSON.stringify(avData), keyIdMap, columnTypeMap }
}
