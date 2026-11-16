import type { AttrSchemaItem } from '@/types/schema'

export interface SchemaGroupDef {
  id: string
  labelKey: string
  defaultLabel: string
  keys: string[]
}

export const SCHEMA_GROUP_DEFS: SchemaGroupDef[] = [
  {
    id: 'task',
    labelKey: 'schemaGroupTask',
    defaultLabel: '任务协同与项目推进',
    keys: [
      'custom-status',
      'custom-priority',
      'custom-task-type',
      'custom-stage',
      'custom-milestone',
      'custom-progress',
      'custom-estimate-hours',
      'custom-actual-hours',
      'custom-archived',
      'custom-starred',
    ],
  },
  {
    id: 'schedule',
    labelKey: 'schemaGroupSchedule',
    defaultLabel: '时间与日程规划',
    keys: [
      'custom-deadline',
      'custom-start-date',
      'custom-review-date',
    ],
  },
  {
    id: 'meeting',
    labelKey: 'schemaGroupMeeting',
    defaultLabel: '会议沟通与团队协作',
    keys: [
      'custom-meeting-type',
      'custom-meeting-date',
      'custom-host',
      'custom-participants',
      'custom-area',
      'custom-project',
      'custom-assignee',
      'custom-source',
      'custom-relation',
    ],
  },
  {
    id: 'reading',
    labelKey: 'schemaGroupReading',
    defaultLabel: '阅读学习与文献知识',
    keys: [
      'custom-doc-type',
      'custom-category',
      'custom-author',
      'custom-publisher',
      'custom-reading-status',
      'custom-reading-progress',
      'custom-total-pages',
      'custom-difficulty',
      'custom-summary',
      'custom-isbn',
    ],
  },
  {
    id: 'okr',
    labelKey: 'schemaGroupOkr',
    defaultLabel: '目标管理与关键结果 (OKR)',
    keys: [
      'custom-quarter',
      'custom-kr-type',
      'custom-confidence',
      'custom-target-value',
      'custom-current-value',
    ],
  },
  {
    id: 'life',
    labelKey: 'schemaGroupLife',
    defaultLabel: '日常生活与健康打卡',
    keys: [
      'custom-weather',
      'custom-mood',
      'custom-energy',
      'custom-rating',
      'custom-location',
      'custom-sleep-hours',
      'custom-weight',
      'custom-water-intake',
      'custom-exercise-type',
      'custom-exercise-duration',
      'custom-calorie',
    ],
  },
  {
    id: 'finance',
    labelKey: 'schemaGroupFinance',
    defaultLabel: '个人收支与财务消费',
    keys: [
      'custom-cost',
      'custom-expense-type',
      'custom-payment-method',
      'custom-is-essential',
      'custom-account',
    ],
  },
  {
    id: 'contacts',
    labelKey: 'schemaGroupContacts',
    defaultLabel: '人脉网络与联系人 (CRM)',
    keys: [
      'custom-relationship',
      'custom-company',
      'custom-position',
      'custom-birthday',
      'custom-last-contact',
      'custom-email',
      'custom-phone',
    ],
  },
  {
    id: 'media',
    labelKey: 'schemaGroupMedia',
    defaultLabel: '影音影视与文化娱乐',
    keys: [
      'custom-media-type',
      'custom-watch-status',
      'custom-release-year',
      'custom-director',
      'custom-genre',
    ],
  },
  {
    id: 'av',
    labelKey: 'schemaGroupAv',
    defaultLabel: '数据库 (AV) 对齐属性',
    keys: [
      'custom-labels',
      'custom-link',
      'custom-attachment',
    ],
  },
]

export interface GroupedSchemaSection {
  id: string
  labelKey: string
  label: string
  items: AttrSchemaItem[]
}

/**
 * 将平铺的 schemas 按照预设分组结构归类，
 * 不属于内置分组的属性自动汇入 "用户自定义属性" (custom) 分组。
 */
export function groupSchemas(
  schemas: Record<string, AttrSchemaItem>,
  t?: (key: string) => string,
): GroupedSchemaSection[] {
  const result: GroupedSchemaSection[] = []
  const assignedKeys = new Set<string>()

  // 1. 处理预设分组
  for (const def of SCHEMA_GROUP_DEFS) {
    const items: AttrSchemaItem[] = []
    for (const k of def.keys) {
      if (schemas[k]) {
        items.push(schemas[k])
        assignedKeys.add(k)
      }
    }
    if (items.length > 0) {
      result.push({
        id: def.id,
        labelKey: def.labelKey,
        label: t ? t(def.labelKey) : def.defaultLabel,
        items,
      })
    }
  }

  // 2. 收集用户自定义属性
  const customItems: AttrSchemaItem[] = []
  for (const [k, item] of Object.entries(schemas)) {
    if (!assignedKeys.has(k)) {
      customItems.push(item)
    }
  }

  if (customItems.length > 0) {
    result.push({
      id: 'custom',
      labelKey: 'schemaGroupCustom',
      label: t ? t('schemaGroupCustom') : '用户自定义属性',
      items: customItems,
    })
  }

  return result
}
