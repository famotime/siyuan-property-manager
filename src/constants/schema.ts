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

export interface AttrFormatOption {
  value: string
  labelKey: string
}

/** 日期展示格式（只影响展示态，存储值恒为规范格式）。 */
export const DATE_FORMAT_OPTIONS: AttrFormatOption[] = [
  { value: 'YYYY-MM-DD', labelKey: 'dateFormatYMD' },
  { value: 'YYYY-MM-DD HH:mm', labelKey: 'dateFormatYMDHM' },
  { value: 'YYYY-MM-DD HH:mm:ss', labelKey: 'dateFormatYMDHMS' },
]

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD'

/** 数字展示格式。 */
export const NUMBER_FORMAT_OPTIONS: AttrFormatOption[] = [
  { value: 'number', labelKey: 'numberFormatNumber' },
  { value: 'currency', labelKey: 'numberFormatCurrency' },
  { value: 'percent', labelKey: 'numberFormatPercent' },
]

export const DEFAULT_NUMBER_FORMAT = 'number'

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
  'custom-task-type': {
    name: 'custom-task-type',
    type: 'select',
    label: '任务类型',
    options: [
      { id: 'req', label: '需求', value: '需求', color: '#2563eb' },
      { id: 'bug', label: '缺陷', value: '缺陷', color: '#dc2626' },
      { id: 'opt', label: '优化', value: '优化', color: '#059669' },
      { id: 'task', label: '事务', value: '事务', color: '#ea580c' },
      { id: 'research', label: '调研', value: '调研', color: '#7c3aed' },
    ],
  },
  'custom-stage': {
    name: 'custom-stage',
    type: 'select',
    label: '阶段',
    options: [
      { id: 'plan', label: '规划', value: '规划', color: '#64748b' },
      { id: 'design', label: '设计', value: '设计', color: '#7c3aed' },
      { id: 'dev', label: '实施', value: '实施', color: '#2563eb' },
      { id: 'qa', label: '验收', value: '验收', color: '#ea580c' },
      { id: 'release', label: '已上线', value: '已上线', color: '#059669' },
    ],
  },
  'custom-milestone': {
    name: 'custom-milestone',
    type: 'text',
    label: '里程碑',
  },
  'custom-estimate-hours': {
    name: 'custom-estimate-hours',
    type: 'number',
    label: '预估工时 (h)',
    numberFormat: 'number',
  },
  'custom-actual-hours': {
    name: 'custom-actual-hours',
    type: 'number',
    label: '实际工时 (h)',
    numberFormat: 'number',
  },
  'custom-category': {
    name: 'custom-category',
    type: 'select',
    label: '分类',
    options: [
      { id: 'log', label: 'Log（事实）', value: 'Log（事实）', color: '#2563eb' },
      { id: 'ask', label: 'Ask（疑问）', value: 'Ask（疑问）', color: '#ea580c' },
      { id: 'exp', label: 'Exp（经验）', value: 'Exp（经验）', color: '#059669' },
      { id: 'how', label: 'How（方法）', value: 'How（方法）', color: '#7c3aed' },
      { id: 'idea', label: 'Idea（灵感）', value: 'Idea（灵感）', color: '#ca8a04' },
    ],
  },
  'custom-progress': {
    name: 'custom-progress',
    type: 'number',
    label: '进度 (%)',
    numberFormat: 'percent',
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

  // ---- 会议沟通与团队协作 ----
  'custom-meeting-type': {
    name: 'custom-meeting-type',
    type: 'select',
    label: '会议类型',
    options: [
      { id: 'daily', label: '站会', value: '站会', color: '#2563eb' },
      { id: 'weekly', label: '例会', value: '例会', color: '#059669' },
      { id: 'review', label: '评审', value: '评审', color: '#ea580c' },
      { id: 'one_on_one', label: '1-on-1', value: '1-on-1', color: '#7c3aed' },
      { id: 'retrospective', label: '复盘', value: '复盘', color: '#ca8a04' },
      { id: 'external', label: '外部会谈', value: '外部会谈', color: '#0891b2' },
    ],
  },
  'custom-meeting-date': {
    name: 'custom-meeting-date',
    type: 'date',
    label: '会议日期',
  },
  'custom-host': {
    name: 'custom-host',
    type: 'text',
    label: '主持人',
  },
  'custom-participants': {
    name: 'custom-participants',
    type: 'text',
    label: '参会人员',
  },
  'custom-area': {
    name: 'custom-area',
    type: 'select',
    label: '所属领域',
    options: [
      { id: 'health', label: '身心健康', value: '身心健康', color: '#059669' },
      { id: 'tech', label: '技术精进', value: '技术精进', color: '#2563eb' },
      { id: 'finance', label: '财富管理', value: '财富管理', color: '#ca8a04' },
      { id: 'career', label: '工作职业', value: '工作职业', color: '#7c3aed' },
      { id: 'family', label: '家庭生活', value: '家庭生活', color: '#ea580c' },
      { id: 'growth', label: '个人成长', value: '个人成长', color: '#0891b2' },
    ],
  },
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

  // ---- 学习认知与文献阅读 ----
  'custom-doc-type': {
    name: 'custom-doc-type',
    type: 'select',
    label: '资料类型',
    options: [
      { id: 'reading', label: '读书笔记', value: '读书笔记', color: '#059669' },
      { id: 'tech', label: '技术文档', value: '技术文档', color: '#2563eb' },
      { id: 'paper', label: '论文文献', value: '论文文献', color: '#7c3aed' },
      { id: 'report', label: '行业报告', value: '行业报告', color: '#0891b2' },
      { id: 'course', label: '课程讲义', value: '课程讲义', color: '#ca8a04' },
      { id: 'memo', label: '备忘速查', value: '备忘速查', color: '#6b7280' },
    ],
  },
  'custom-author': {
    name: 'custom-author',
    type: 'text',
    label: '作者',
  },
  'custom-publisher': {
    name: 'custom-publisher',
    type: 'text',
    label: '出版机构',
  },
  'custom-reading-status': {
    name: 'custom-reading-status',
    type: 'select',
    label: '阅读状态',
    options: [
      { id: 'want', label: '想读', value: '想读', color: '#64748b' },
      { id: 'reading', label: '在读', value: '在读', color: '#2563eb' },
      { id: 'read', label: '已读', value: '已读', color: '#059669' },
      { id: 're-read', label: '精读复读', value: '精读复读', color: '#7c3aed' },
      { id: 'dropped', label: '弃读', value: '弃读', color: '#94a3b8' },
    ],
  },
  'custom-reading-progress': {
    name: 'custom-reading-progress',
    type: 'number',
    label: '当前页码',
    numberFormat: 'number',
  },
  'custom-total-pages': {
    name: 'custom-total-pages',
    type: 'number',
    label: '总页数',
    numberFormat: 'number',
  },
  'custom-difficulty': {
    name: 'custom-difficulty',
    type: 'select',
    label: '难度评级',
    options: [
      { id: 'easy', label: '入门科普', value: '入门科普', color: '#059669' },
      { id: 'medium', label: '进阶应用', value: '进阶应用', color: '#2563eb' },
      { id: 'hard', label: '专业深入', value: '专业深入', color: '#ca8a04' },
      { id: 'expert', label: '核心前沿', value: '核心前沿', color: '#dc2626' },
    ],
  },
  'custom-summary': {
    name: 'custom-summary',
    type: 'text',
    label: '核心要点',
  },
  'custom-isbn': {
    name: 'custom-isbn',
    type: 'text',
    label: 'ISBN编码',
  },

  // ---- 目标管理与关键结果 (OKR) ----
  'custom-quarter': {
    name: 'custom-quarter',
    type: 'select',
    label: '规划周期',
    options: [
      { id: 'q1', label: 'Q1', value: 'Q1', color: '#2563eb' },
      { id: 'q2', label: 'Q2', value: 'Q2', color: '#059669' },
      { id: 'q3', label: 'Q3', value: 'Q3', color: '#ea580c' },
      { id: 'q4', label: 'Q4', value: 'Q4', color: '#7c3aed' },
      { id: 'year', label: '年度目标', value: '年度目标', color: '#ca8a04' },
    ],
  },
  'custom-kr-type': {
    name: 'custom-kr-type',
    type: 'select',
    label: '指标类型',
    options: [
      { id: 'growth', label: '数值增长', value: '数值增长', color: '#2563eb' },
      { id: 'milestone', label: '里程碑交付', value: '里程碑交付', color: '#059669' },
      { id: 'baseline', label: '维持基线', value: '维持基线', color: '#64748b' },
    ],
  },
  'custom-confidence': {
    name: 'custom-confidence',
    type: 'select',
    label: '达成信心',
    options: [
      { id: 'high', label: '高信心', value: '高信心', color: '#059669' },
      { id: 'mid', label: '中等', value: '中等', color: '#ca8a04' },
      { id: 'low', label: '风险预警', value: '风险预警', color: '#dc2626' },
    ],
  },
  'custom-target-value': {
    name: 'custom-target-value',
    type: 'number',
    label: '目标数值',
    numberFormat: 'number',
  },
  'custom-current-value': {
    name: 'custom-current-value',
    type: 'number',
    label: '当前数值',
    numberFormat: 'number',
  },

  // ---- 日常生活与健康打卡 ----
  'custom-weather': {
    name: 'custom-weather',
    type: 'select',
    label: '天气',
    options: [
      { id: 'sunny', label: '晴', value: '晴', color: '#ca8a04' },
      { id: 'cloudy', label: '多云', value: '多云', color: '#2563eb' },
      { id: 'overcast', label: '阴', value: '阴', color: '#6b7280' },
      { id: 'rain', label: '雨', value: '雨', color: '#0891b2' },
      { id: 'snow', label: '雪', value: '雪', color: '#7c3aed' },
      { id: 'fog', label: '霾/雾', value: '霾/雾', color: '#94a3b8' },
    ],
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
  'custom-rating': {
    name: 'custom-rating',
    type: 'number',
    label: '评分',
  },
  'custom-location': {
    name: 'custom-location',
    type: 'text',
    label: '地点',
  },
  'custom-sleep-hours': {
    name: 'custom-sleep-hours',
    type: 'number',
    label: '睡眠时长 (h)',
    numberFormat: 'number',
  },
  'custom-weight': {
    name: 'custom-weight',
    type: 'number',
    label: '体重 (kg)',
    numberFormat: 'number',
  },
  'custom-water-intake': {
    name: 'custom-water-intake',
    type: 'number',
    label: '饮水量 (ml)',
    numberFormat: 'number',
  },
  'custom-exercise-type': {
    name: 'custom-exercise-type',
    type: 'select',
    label: '运动类型',
    options: [
      { id: 'running', label: '跑步', value: '跑步', color: '#2563eb' },
      { id: 'fitness', label: '健身力量', value: '健身力量', color: '#dc2626' },
      { id: 'cycling', label: '骑行', value: '骑行', color: '#059669' },
      { id: 'swimming', label: '游泳', value: '游泳', color: '#0891b2' },
      { id: 'walking', label: '散步健步', value: '散步健步', color: '#ca8a04' },
      { id: 'yoga', label: '瑜伽拉伸', value: '瑜伽拉伸', color: '#7c3aed' },
    ],
  },
  'custom-exercise-duration': {
    name: 'custom-exercise-duration',
    type: 'number',
    label: '运动时长 (min)',
    numberFormat: 'number',
  },
  'custom-calorie': {
    name: 'custom-calorie',
    type: 'number',
    label: '热量消耗 (kcal)',
    numberFormat: 'number',
  },

  // ---- 个人收支与财务消费 ----
  'custom-cost': {
    name: 'custom-cost',
    type: 'number',
    label: '花费金额',
    numberFormat: 'currency',
  },
  'custom-expense-type': {
    name: 'custom-expense-type',
    type: 'select',
    label: '支出类目',
    options: [
      { id: 'food', label: '餐饮美食', value: '餐饮美食', color: '#ea580c' },
      { id: 'daily', label: '居家生活', value: '居家生活', color: '#2563eb' },
      { id: 'transport', label: '交通出行', value: '交通出行', color: '#0891b2' },
      { id: 'entertainment', label: '休闲娱乐', value: '休闲娱乐', color: '#7c3aed' },
      { id: 'medical', label: '医疗保健', value: '医疗保健', color: '#059669' },
      { id: 'digital', label: '数码装备', value: '数码装备', color: '#64748b' },
      { id: 'education', label: '学习提升', value: '学习提升', color: '#ca8a04' },
    ],
  },
  'custom-payment-method': {
    name: 'custom-payment-method',
    type: 'select',
    label: '支付方式',
    options: [
      { id: 'wechat', label: '微信支付', value: '微信支付', color: '#059669' },
      { id: 'alipay', label: '支付宝', value: '支付宝', color: '#2563eb' },
      { id: 'credit', label: '信用卡', value: '信用卡', color: '#ea580c' },
      { id: 'bank', label: '储蓄卡', value: '储蓄卡', color: '#7c3aed' },
      { id: 'cash', label: '现金', value: '现金', color: '#64748b' },
    ],
  },
  'custom-is-essential': {
    name: 'custom-is-essential',
    type: 'checkbox',
    label: '必要支出 (刚需)',
  },
  'custom-account': {
    name: 'custom-account',
    type: 'text',
    label: '支付账户',
  },

  // ---- 人脉网络与联系人 (CRM) ----
  'custom-relationship': {
    name: 'custom-relationship',
    type: 'select',
    label: '关系定位',
    options: [
      { id: 'family', label: '亲友家人', value: '亲友家人', color: '#dc2626' },
      { id: 'colleague', label: '工作伙伴', value: '工作伙伴', color: '#2563eb' },
      { id: 'client', label: '业务客户', value: '业务客户', color: '#ea580c' },
      { id: 'mentor', label: '导师前辈', value: '导师前辈', color: '#7c3aed' },
      { id: 'peer', label: '行业同行', value: '行业同行', color: '#059669' },
      { id: 'friend', label: '朋友熟人', value: '朋友熟人', color: '#0891b2' },
    ],
  },
  'custom-company': {
    name: 'custom-company',
    type: 'text',
    label: '单位/机构',
  },
  'custom-position': {
    name: 'custom-position',
    type: 'text',
    label: '职位/角色',
  },
  'custom-birthday': {
    name: 'custom-birthday',
    type: 'date',
    label: '生日日期',
  },
  'custom-last-contact': {
    name: 'custom-last-contact',
    type: 'date',
    label: '上次联络',
  },

  // ---- 影音影视与文化娱乐 ----
  'custom-media-type': {
    name: 'custom-media-type',
    type: 'select',
    label: '媒介类型',
    options: [
      { id: 'movie', label: '电影', value: '电影', color: '#2563eb' },
      { id: 'series', label: '剧集', value: '剧集', color: '#7c3aed' },
      { id: 'doc', label: '纪录片', value: '纪录片', color: '#0891b2' },
      { id: 'anime', label: '动漫番剧', value: '动漫番剧', color: '#ea580c' },
      { id: 'podcast', label: '播客节目', value: '播客节目', color: '#059669' },
      { id: 'game', label: '电子游戏', value: '电子游戏', color: '#ca8a04' },
    ],
  },
  'custom-watch-status': {
    name: 'custom-watch-status',
    type: 'select',
    label: '消费状态',
    options: [
      { id: 'want', label: '想看/玩', value: '想看/玩', color: '#64748b' },
      { id: 'watching', label: '在看/玩', value: '在看/玩', color: '#2563eb' },
      { id: 'done', label: '已看/通关', value: '已看/通关', color: '#059669' },
      { id: 'repeat', label: '重温二刷', value: '重温二刷', color: '#7c3aed' },
      { id: 'dropped', label: '弃坑', value: '弃坑', color: '#94a3b8' },
    ],
  },
  'custom-release-year': {
    name: 'custom-release-year',
    type: 'number',
    label: '上映/发行年',
    numberFormat: 'number',
  },
  'custom-director': {
    name: 'custom-director',
    type: 'text',
    label: '导演/制作方',
  },
  'custom-genre': {
    name: 'custom-genre',
    type: 'select',
    label: '流派题材',
    options: [
      { id: 'scifi', label: '科幻', value: '科幻', color: '#2563eb' },
      { id: 'suspense', label: '悬疑犯罪', value: '悬疑犯罪', color: '#7c3aed' },
      { id: 'drama', label: '剧情人文', value: '剧情人文', color: '#059669' },
      { id: 'comedy', label: '喜剧搞笑', value: '喜剧搞笑', color: '#ca8a04' },
      { id: 'fantasy', label: '奇幻冒险', value: '奇幻冒险', color: '#ea580c' },
      { id: 'history', label: '历史纪录', value: '历史纪录', color: '#6b7280' },
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
    options: [
      { id: 'featured', label: '精选', value: '精选', color: '#ea580c' },
      { id: 'inbox', label: '待整理', value: '待整理', color: '#64748b' },
      { id: 'pinned', label: '置顶', value: '置顶', color: '#dc2626' },
      { id: 'core', label: '核心', value: '核心', color: '#2563eb' },
    ],
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

