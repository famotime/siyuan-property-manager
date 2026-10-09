import type { AttrType } from '@/types/schema'

export const TYPES_SCHEMA_STORAGE_NAME = 'types-schema.json'

export const DEFAULT_ATTR_TYPE: AttrType = 'text'

export interface AttrTypeMeta {
  type: AttrType
  icon: string
  labelKey: string
}

export const ATTR_TYPE_METAS: AttrTypeMeta[] = [
  { type: 'text', icon: 'text', labelKey: 'typeText' },
  { type: 'number', icon: 'number', labelKey: 'typeNumber' },
  { type: 'select', icon: 'select', labelKey: 'typeSelect' },
  { type: 'multi-select', icon: 'multiSelect', labelKey: 'typeMultiSelect' },
  { type: 'date', icon: 'date', labelKey: 'typeDate' },
  { type: 'checkbox', icon: 'checkbox', labelKey: 'typeCheckbox' },
  { type: 'block-ref', icon: 'blockRef', labelKey: 'typeBlockRef' },
]

export interface PresetColor {
  name: string
  bg: string
  color: string
}

export const PRESET_TAG_COLORS: PresetColor[] = [
  { name: 'blue', bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' },
  { name: 'green', bg: 'rgba(16, 185, 129, 0.15)', color: '#059669' },
  { name: 'orange', bg: 'rgba(249, 115, 22, 0.15)', color: '#ea580c' },
  { name: 'purple', bg: 'rgba(139, 92, 246, 0.15)', color: '#7c3aed' },
  { name: 'red', bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' },
  { name: 'yellow', bg: 'rgba(234, 179, 8, 0.18)', color: '#ca8a04' },
  { name: 'cyan', bg: 'rgba(6, 182, 212, 0.15)', color: '#0891b2' },
  { name: 'gray', bg: 'rgba(107, 114, 128, 0.15)', color: '#4b5563' },
]

import type { AttrSchemaItem } from '@/types/schema'

/**
 * 常见工作与生活笔记场景的开箱即用预设属性
 */
export const DEFAULT_PRESET_SCHEMAS: Record<string, AttrSchemaItem> = {
  // ---- 核心状态与任务推进 ----
  'custom-status': {
    name: 'custom-status',
    type: 'select',
    label: '状态',
    options: [
      { id: 'todo', label: '待办', value: '待办', color: '#64748b' },
      { id: 'in_progress', label: '进行中', value: '进行中', color: '#2563eb' },
      { id: 'done', label: '已完成', value: '已完成', color: '#059669' },
      { id: 'paused', label: '挂起', value: '挂起', color: '#ea580c' },
      { id: 'canceled', label: '已取消', value: '已取消', color: '#94a3b8' },
    ],
  },
  'custom-priority': {
    name: 'custom-priority',
    type: 'select',
    label: '优先级',
    options: [
      { id: 'p0', label: 'P0 - 紧急', value: 'P0', color: '#dc2626' },
      { id: 'p1', label: 'P1 - 高', value: 'P1', color: '#ea580c' },
      { id: 'p2', label: 'P2 - 中', value: 'P2', color: '#ca8a04' },
      { id: 'p3', label: 'P3 - 低', value: 'P3', color: '#64748b' },
    ],
  },
  'custom-category': {
    name: 'custom-category',
    type: 'select',
    label: '分类',
    options: [
      { id: 'fact', label: '事实', value: '事实', color: '#2563eb' },
      { id: 'question', label: '疑问', value: '疑问', color: '#ea580c' },
      { id: 'experience', label: '经验', value: '经验', color: '#059669' },
      { id: 'method', label: '方法', value: '方法', color: '#7c3aed' },
      { id: 'idea', label: '灵感', value: '灵感', color: '#ca8a04' },
      { id: 'info', label: '信息', value: '信息', color: '#0891b2' },
    ],
  },
  'custom-progress': {
    name: 'custom-progress',
    type: 'number',
    label: '进度 (%)',
  },
  'custom-archived': {
    name: 'custom-archived',
    type: 'checkbox',
    label: '已归档',
  },
  'custom-starred': {
    name: 'custom-starred',
    type: 'checkbox',
    label: '重点关注',
  },

  // ---- 时间与日程规划 ----
  'custom-deadline': {
    name: 'custom-deadline',
    type: 'date',
    label: '截止日期',
  },
  'custom-start-date': {
    name: 'custom-start-date',
    type: 'date',
    label: '开始日期',
  },
  'custom-review-date': {
    name: 'custom-review-date',
    type: 'date',
    label: '复盘日期',
  },

  // ---- 项目管理与来源 ----
  'custom-project': {
    name: 'custom-project',
    type: 'text',
    label: '所属项目',
  },
  'custom-assignee': {
    name: 'custom-assignee',
    type: 'text',
    label: '负责人',
  },
  'custom-source': {
    name: 'custom-source',
    type: 'text',
    label: '来源渠道',
  },
  'custom-relation': {
    name: 'custom-relation',
    type: 'block-ref',
    label: '关联',
  },

  // ---- 生活记录、阅读与量化 ----
  'custom-rating': {
    name: 'custom-rating',
    type: 'number',
    label: '评分',
  },
  'custom-cost': {
    name: 'custom-cost',
    type: 'number',
    label: '花费金额',
  },
  'custom-mood': {
    name: 'custom-mood',
    type: 'select',
    label: '今日心情',
    options: [
      { id: 'happy', label: '开心愉悦', value: '开心愉悦', color: '#059669' },
      { id: 'calm', label: '平和充实', value: '平和充实', color: '#2563eb' },
      { id: 'tired', label: '疲惫焦虑', value: '疲惫焦虑', color: '#ea580c' },
      { id: 'low', label: '低落思考', value: '低落思考', color: '#6b7280' },
    ],
  },
  'custom-energy': {
    name: 'custom-energy',
    type: 'select',
    label: '精力消耗',
    options: [
      { id: 'low', label: '轻松', value: '轻松', color: '#059669' },
      { id: 'medium', label: '适中', value: '适中', color: '#ca8a04' },
      { id: 'high', label: '高耗能', value: '高耗能', color: '#dc2626' },
    ],
  },

  // ---- 对齐思源数据库（属性视图）列类型 ----
  // 思源 AV 共 17 种列类型（kernel/av/av.go），其中 template/rollup/lineNumber/block
  // 属 AV 内部概念（公式、汇总、行号、主键），created/updated 由系统托管，
  // 对「块的 IAL 属性」无语义，故不设预设。此处仅补齐尚未覆盖的类型。
  // 注意：多选预设不可取名 custom-tags，该键存在到 custom-category 的历史迁移。
  'custom-labels': {
    name: 'custom-labels',
    type: 'multi-select',
    label: '标签',
  },
  'custom-link': {
    name: 'custom-link',
    type: 'text',
    label: '链接',
  },
  'custom-email': {
    name: 'custom-email',
    type: 'text',
    label: '邮箱',
  },
  'custom-phone': {
    name: 'custom-phone',
    type: 'text',
    label: '电话',
  },
  'custom-attachment': {
    name: 'custom-attachment',
    type: 'text',
    label: '附件',
  },
}

