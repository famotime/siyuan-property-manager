/**
 * 内置即现 (siyuan-live-slides) 演示属性预设模板字典。
 * 与 siyuan-live-slides 插件深度协同，提供开箱即用的幻灯片版式与微动效。
 */

export interface PresetTemplateItem {
  key: string
  value: string
}

export interface PresetTemplate {
  id: string
  name: string
  open: boolean
  attrs: PresetTemplateItem[]
}

export const SLIDES_PRESET_TEMPLATES: PresetTemplate[] = [
  // 1. 页面级版式预设
  {
    id: 'slides-cover',
    name: '幻灯片 - 封面页 (Cover)',
    open: true,
    attrs: [
      { key: 'slides-slide', value: 'true' },
      { key: 'slides-layout', value: 'cover' },
      { key: 'slides-transition', value: 'fade' },
    ],
  },
  {
    id: 'slides-two-cols',
    name: '幻灯片 - 双栏对比 (Two Columns)',
    open: true,
    attrs: [
      { key: 'slides-slide', value: 'true' },
      { key: 'slides-layout', value: 'two-cols' },
      { key: 'slides-transition', value: 'slide-left' },
    ],
  },
  {
    id: 'slides-fact',
    name: '幻灯片 - 大字报与核心指标 (Fact)',
    open: true,
    attrs: [
      { key: 'slides-slide', value: 'true' },
      { key: 'slides-layout', value: 'fact' },
      { key: 'slides-transition', value: 'zoom' },
    ],
  },
  {
    id: 'slides-intro',
    name: '幻灯片 - 章节导引与作者 (Intro)',
    open: true,
    attrs: [
      { key: 'slides-slide', value: 'true' },
      { key: 'slides-layout', value: 'intro' },
      { key: 'slides-transition', value: 'slide-up' },
    ],
  },
  {
    id: 'slides-quote',
    name: '幻灯片 - 金句与强调 (Quote)',
    open: true,
    attrs: [
      { key: 'slides-slide', value: 'true' },
      { key: 'slides-layout', value: 'quote' },
      { key: 'slides-transition', value: 'fade' },
    ],
  },
  // 2. 元素级动效与排版预设
  {
    id: 'slides-elem-click',
    name: '元素 - 顺延逐步呈现 (v-click)',
    open: true,
    attrs: [
      { key: 'slides-click', value: '+1' },
    ],
  },
  {
    id: 'slides-elem-click-hide',
    name: '元素 - 隐藏直到激活 (v-click:hide)',
    open: true,
    attrs: [
      { key: 'slides-click', value: 'hide' },
    ],
  },
  {
    id: 'slides-elem-slot-right',
    name: '元素 - 双栏右栏归属 (Slot: Right)',
    open: true,
    attrs: [
      { key: 'slides-slot', value: 'right' },
    ],
  },
  {
    id: 'slides-shiki-lines',
    name: '代码 - 逐行聚光高亮 (Shiki)',
    open: true,
    attrs: [
      { key: 'slides-shiki-lines', value: '1-3' },
    ],
  },
]

export const SLIDEV_PRESET_TEMPLATES = SLIDES_PRESET_TEMPLATES
