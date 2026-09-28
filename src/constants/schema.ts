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
 * 常见知识与任务管理场景的开箱即用预设属性
 */
export const DEFAULT_PRESET_SCHEMAS: Record<string, AttrSchemaItem> = {
  'custom-status': {
    name: 'custom-status',
    type: 'select',
    label: '状态',
    options: [
      { id: 'todo', label: '待办', value: '待办', color: '#64748b' },
      { id: 'in_progress', label: '进行中', value: '进行中', color: '#2563eb' },
      { id: 'done', label: '已完成', value: '已完成', color: '#059669' },
      { id: 'paused', label: '挂起', value: '挂起', color: '#ea580c' },
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
  'custom-tags': {
    name: 'custom-tags',
    type: 'multi-select',
    label: '标签',
    options: [
      { id: 'work', label: '工作', value: '工作', color: '#2563eb' },
      { id: 'personal', label: '个人', value: '个人', color: '#7c3aed' },
      { id: 'study', label: '学习', value: '学习', color: '#059669' },
      { id: 'project', label: '项目', value: '项目', color: '#dc2626' },
    ],
  },
  'custom-deadline': {
    name: 'custom-deadline',
    type: 'date',
    label: '截止日期',
  },
  'custom-archived': {
    name: 'custom-archived',
    type: 'checkbox',
    label: '已归档',
  },
  'custom-rating': {
    name: 'custom-rating',
    type: 'number',
    label: '评分',
  },
  'custom-progress': {
    name: 'custom-progress',
    type: 'number',
    label: '进度 (%)',
  },
}

