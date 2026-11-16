import type { App as VueApp } from 'vue'
import type { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import DocInlineAttrs from './components/DocInlineAttrs.vue'
import {
  DOC_INLINE_ATTRS_HOST_CLASS,
  isRelevantDocInlineMutation,
  resolveDocInlineAttrsMountPlan,
} from '@/utils/docInlineAttrs'

interface InlineMount {
  app: VueApp
  docId: string
  host: HTMLElement
}

const mounts = new Map<HTMLElement, InlineMount>()
/** host → 上次同步的标题样式签名；未变化则跳过样式写入（SM-114）。 */
const hostStyleSignatures = new WeakMap<HTMLElement, string>()
let observer: MutationObserver | null = null
let plugin: Plugin | null = null
let refreshTimer: number | null = null

function scheduleRefresh() {
  if (refreshTimer !== null)
    window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    refreshDocInlineAttrs()
  }, 80)
}

function getMountElements(protyle: HTMLElement) {
  const title = protyle.querySelector<HTMLElement>('.protyle-title')
  const body = protyle.querySelector<HTMLElement>('.protyle-wysiwyg')
  const plan = resolveDocInlineAttrsMountPlan({
    bodyPresent: !!body,
    protyleDocId: protyle.dataset.docId,
    titleNodeId: title?.dataset.nodeId,
    titlePresent: !!title,
  })

  if (!title || !body || !plan)
    return null

  return { body, docId: plan.docId }
}

function mountHost(host: HTMLElement, docId: string) {
  if (!plugin)
    return

  const app = createApp({
    render: () => h(DocInlineAttrs, { docId }),
  })
  app.provide('plugin', plugin)
  app.mount(host)
  mounts.set(host, { app, docId, host })
}

function syncHostStyleWith(host: HTMLElement, title: HTMLElement): void {
  const titleStyle = window.getComputedStyle(title)
  const signature = [
    titleStyle.maxWidth,
    titleStyle.paddingLeft,
    titleStyle.paddingRight,
    titleStyle.marginLeft,
    titleStyle.marginRight,
  ].join('|')
  if (hostStyleSignatures.get(host) === signature)
    return
  hostStyleSignatures.set(host, signature)
  host.style.maxWidth = titleStyle.maxWidth
  host.style.paddingLeft = titleStyle.paddingLeft
  host.style.paddingRight = titleStyle.paddingRight
  host.style.marginLeft = titleStyle.marginLeft
  host.style.marginRight = titleStyle.marginRight
}

function ensureProtyleInlineAttrs(protyle: HTMLElement) {
  const elements = getMountElements(protyle)
  if (!elements)
    return

  let host = protyle.querySelector<HTMLElement>(`:scope .${DOC_INLINE_ATTRS_HOST_CLASS}`)
  if (host && !host.parentElement)
    host = null

  if (!host) {
    host = document.createElement('div')
    host.className = DOC_INLINE_ATTRS_HOST_CLASS
  }

  if (host.parentElement !== elements.body.parentElement || host.nextSibling !== elements.body)
    elements.body.parentElement?.insertBefore(host, elements.body)

  // 同步当前编辑器的标题样式以保持宽度和外边距对齐（签名未变化时跳过写入，
  // 避免每次刷新都对全部 protyle 强制样式失效，SM-114）
  const title = protyle.querySelector<HTMLElement>('.protyle-title')
  if (title)
    syncHostStyleWith(host, title)

  const mounted = mounts.get(host)
  if (mounted?.docId === elements.docId)
    return

  if (mounted)
    mounted.app.unmount()
  host.dataset.docId = elements.docId
  mountHost(host, elements.docId)
}

function cleanupDetachedMounts() {
  for (const [host, mounted] of mounts) {
    if (!document.body.contains(host)) {
      mounted.app.unmount()
      mounts.delete(host)
    }
  }
}

export function refreshDocInlineAttrs() {
  if (!plugin || typeof document === 'undefined')
    return

  cleanupDetachedMounts()
  document.querySelectorAll<HTMLElement>('.protyle').forEach(ensureProtyleInlineAttrs)
}

export function mountDocInlineAttrs(pluginInstance: Plugin) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined')
    return

  plugin = pluginInstance
  refreshDocInlineAttrs()

  if (observer)
    return

  observer = new MutationObserver((mutations) => {
    // 相关性预过滤（SM-114）：wysiwyg 内部的块级编辑（击键、建块、懒加载）
    // 不触发刷新；仅结构级变更与 data-doc-id / data-node-id 属性变更调度刷新
    if (mutations.some(isRelevantDocInlineMutation))
      scheduleRefresh()
  })
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-doc-id', 'data-node-id'],
    childList: true,
    subtree: true,
  })
}

export function unmountDocInlineAttrs() {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }

  observer?.disconnect()
  observer = null

  for (const [, mounted] of mounts)
    mounted.app.unmount()
  mounts.clear()

  document.querySelectorAll<HTMLElement>(`.${DOC_INLINE_ATTRS_HOST_CLASS}`).forEach(host => host.remove())
  plugin = null
}
