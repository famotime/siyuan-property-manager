/**
 * 内置 Slidev 演示属性预设模板字典。
 * 与 siyuan-slidev 插件深度协同，提供开箱即用的幻灯片版式与微动效。
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

export const SLIDEV_PRESET_TEMPLATES: PresetTemplate[] = [
  // 1. 页面级版式预设
  {
    id: 'slidev-cover',
    name: '幻灯片 - 封面页 (Cover)',
    open: true,
    attrs: [
      { key: 'slidev-slide', value: 'true' },
      { key: 'slidev-layout', value: 'cover' },
      { key: 'slidev-transition', value: 'fade' },
    ],
  },
  {
    id: 'slidev-two-cols',
    name: '幻灯片 - 双栏对比 (Two Columns)',
    open: true,
    attrs: [
      { key: 'slidev-slide', value: 'true' },
      { key: 'slidev-layout', value: 'two-cols' },
      { key: 'slidev-transition', value: 'slide-left' },
    ],
  },
  {
    id: 'slidev-fact',
    name: '幻灯片 - 大字报与核心指标 (Fact)',
    open: true,
    attrs: [
      { key: 'slidev-slide', value: 'true' },
      { key: 'slidev-layout', value: 'fact' },
      { key: 'slidev-transition', value: 'zoom' },
    ],
  },
  {
    id: 'slidev-intro',
    name: '幻灯片 - 章节导引与作者 (Intro)',
    open: true,
    attrs: [
      { key: 'slidev-slide', value: 'true' },
      { key: 'slidev-layout', value: 'intro' },
      { key: 'slidev-transition', value: 'slide-up' },
    ],
  },
  {
    id: 'slidev-quote',
    name: '幻灯片 - 金句与强调 (Quote)',
    open: true,
    attrs: [
      { key: 'slidev-slide', value: 'true' },
      { key: 'slidev-layout', value: 'quote' },
      { key: 'slidev-transition', value: 'fade' },
    ],
  },
  // 2. 元素级动效与排版预设
  {
    id: 'slidev-elem-click',
    name: '元素 - 顺延逐步呈现 (v-click)',
    open: true,
    attrs: [
      { key: 'slidev-click', value: '+1' },
    ],
  },
  {
    id: 'slidev-elem-click-hide',
    name: '元素 - 隐藏直到激活 (v-click:hide)',
    open: true,
    attrs: [
      { key: 'slidev-click', value: 'hide' },
    ],
  },
  {
    id: 'slidev-elem-slot-right',
    name: '元素 - 双栏右栏归属 (Slot: Right)',
    open: true,
    attrs: [
      { key: 'slidev-slot', value: 'right' },
    ],
  },
  {
    id: 'slidev-shiki-lines',
    name: '代码 - 逐行聚光高亮 (Shiki)',
    open: true,
    attrs: [
      { key: 'slidev-shiki-lines', value: '1-3' },
    ],
  },
]
