/**
 * 开箱即用的日常工作与生活预设属性模板字典。
 * 遵循四元核心对象模型（领域、项目、任务、笔记），
 * 建立自上而下愿景拆解与自底向上行动沉淀的结构化工作流。
 */

export interface PresetTemplateItem {
  key: string
  value: string
}

export interface PresetTemplate {
  id: string
  name: string
  open: boolean
  description?: string
  attrs: PresetTemplateItem[]
}

export const DEFAULT_PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'tpl-area',
    name: '领域',
    open: true,
    description: '长远愿景与人生主线资产账户（不设定完结，如身心健康、技术精进、财富管理）',
    attrs: [
      { key: 'area', value: '' },
      { key: 'status', value: '进行中' },
      { key: 'priority', value: 'P1' },
      { key: 'summary', value: '' },
      { key: 'review-date', value: '' },
    ],
  },
  {
    id: 'tpl-project',
    name: '项目',
    open: true,
    description: '实现愿景的阶段性规划（有明确产出、开始与结束时间）',
    attrs: [
      { key: 'project', value: '' },
      { key: 'area', value: '' },
      { key: 'stage', value: '实施' },
      { key: 'status', value: '进行中' },
      { key: 'progress', value: '0' },
      { key: 'priority', value: 'P1' },
      { key: 'start-date', value: '' },
      { key: 'deadline', value: '' },
      { key: 'assignee', value: '' },
    ],
  },
  {
    id: 'tpl-task',
    name: '任务',
    open: true,
    description: '最小敏捷动作单元（有状态、排期、预估工时）',
    attrs: [
      { key: 'status', value: '待办' },
      { key: 'priority', value: 'P1' },
      { key: 'task-type', value: '需求' },
      { key: 'project', value: '' },
      { key: 'assignee', value: '' },
      { key: 'deadline', value: '' },
      { key: 'estimate-hours', value: '' },
    ],
  },
  {
    id: 'tpl-note',
    name: '笔记',
    open: true,
    description: '被反复调用的知识资产，且预设 5 类元分类：Log（事实）、Ask（疑问）、Exp（经验）、How（方法）、Idea（灵感）',
    attrs: [
      { key: 'category', value: 'Exp（经验）' },
      { key: 'project', value: '' },
      { key: 'area', value: '' },
      { key: 'labels', value: '' },
      { key: 'source', value: '' },
      { key: 'summary', value: '' },
    ],
  },
]

export function getPresetTemplateTooltip(
  tpl: { id?: string; name: string; description?: string },
  t?: (k: string) => string,
): string {
  const tplId = tpl.id
  const name = tpl.name
  if (tplId === 'tpl-area' || name === '领域') {
    return t ? t('presetTplAreaTooltip') : '领域 (Area)：长远愿景与人生主线资产账户（不设定完结，如身心健康、技术精进、财富管理）'
  }
  if (tplId === 'tpl-project' || name === '项目') {
    return t ? t('presetTplProjectTooltip') : '项目 (Project)：实现愿景的阶段性规划（有明确产出、开始与结束时间）'
  }
  if (tplId === 'tpl-task' || name === '任务') {
    return t ? t('presetTplTaskTooltip') : '任务 (Task)：最小敏捷动作单元（有状态、排期、预估工时）'
  }
  if (tplId === 'tpl-note' || name === '笔记') {
    return t ? t('presetTplNoteTooltip') : '笔记 (Note)：被反复调用的知识资产，且预设 5 类元分类：Log（事实）、Ask（疑问）、Exp（经验）、How（方法）、Idea（灵感）'
  }
  return tpl.description || ''
}
