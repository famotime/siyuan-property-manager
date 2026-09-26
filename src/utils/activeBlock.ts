import type { CurrentBlockKind } from './currentBlockState'

export interface ActiveBlockResult {
  id: string
  kind: CurrentBlockKind
  rootId: string
}

const EXCLUDED_SELECTORS = [
  '.spm-dock',
  '.layout__dockleft',
  '.layout__dockright',
  '.layout__dockbottom',
  '.protyle-popover',
  '.block__popover',
  '.b3-dialog',
]

function getGlobalDoc(doc?: Document): Document | undefined {
  if (doc)
    return doc
  return typeof document !== 'undefined' ? document : undefined
}

function getGlobalWin(win?: Window): Window | undefined {
  if (win)
    return win
  return typeof window !== 'undefined' ? window : undefined
}

/**
 * 检查 protyle 容器是否属于需要排除的非主文档容器（如 dock、popover、dialog 等）
 */
export function isExcludedProtyle(protyle: HTMLElement): boolean {
  for (const selector of EXCLUDED_SELECTORS) {
    if (protyle.closest?.(selector))
      return true
  }
  return false
}

/**
 * 检查元素是否被隐藏（含有 .fn__none、自身/祖先为 display: none 等）
 */
export function isElementHidden(el: HTMLElement): boolean {
  if (el.classList?.contains('fn__none') || Boolean(el.closest?.('.fn__none'))) {
    return true
  }
  if (typeof window !== 'undefined' && el.offsetParent === null) {
    const style = window.getComputedStyle?.(el)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return true
    }
  }
  return false
}

/**
 * 从 protyle 元素中解析出文档的 rootId
 */
export function getDocIdFromProtyle(protyle: HTMLElement): string | null {
  const docId = protyle.getAttribute?.('data-doc-id')
  if (docId)
    return docId

  const titleNodeId = protyle.querySelector?.<HTMLElement>('.protyle-title')?.getAttribute?.('data-node-id')
  if (titleNodeId)
    return titleNodeId

  const wysiwygDocId = protyle.querySelector?.<HTMLElement>('.protyle-wysiwyg')?.getAttribute?.('data-doc-id')
  if (wysiwygDocId)
    return wysiwygDocId

  return null
}

/**
 * 从给定的 DOM 元素尝试解析其所属的块或文档
 */
export function resolveBlockFromElement(el: HTMLElement): ActiveBlockResult | null {
  const protyle = el.closest?.<HTMLElement>('.protyle')
  if (!protyle)
    return null

  if (isExcludedProtyle(protyle) || isElementHidden(protyle))
    return null

  const rootId = getDocIdFromProtyle(protyle)
  if (!rootId)
    return null

  // 1. 如果在文档标题区域 .protyle-title 内
  if (el.closest?.('.protyle-title')) {
    return {
      id: rootId,
      kind: 'doc',
      rootId,
    }
  }

  // 2. 如果在具体的 [data-node-id] 块内
  const blockEl = el.closest?.<HTMLElement>('[data-node-id]')
  if (blockEl) {
    const blockId = blockEl.getAttribute?.('data-node-id')
    if (blockId) {
      return {
        id: blockId,
        kind: blockId === rootId ? 'doc' : 'block',
        rootId,
      }
    }
  }

  // 3. 如果在 .protyle-wysiwyg 编辑区内但未命中具体块
  if (el.closest?.('.protyle-wysiwyg')) {
    return {
      id: rootId,
      kind: 'doc',
      rootId,
    }
  }

  return null
}

/**
 * 查找当前主工作区处于激活/可见状态的 .protyle 元素
 */
export function findActiveProtyle(doc?: Document): HTMLElement | null {
  const d = getGlobalDoc(doc)
  if (!d)
    return null

  // 优先级 1：当前激活分屏窗口 (.layout__wnd--active) 中的可见 protyle
  const activeWndProtyles = d.querySelectorAll?.<HTMLElement>(
    '.layout__center .layout__wnd--active .protyle, .layout__wnd--active .protyle',
  )
  if (activeWndProtyles) {
    for (let i = 0; i < activeWndProtyles.length; i++) {
      const p = activeWndProtyles[i]
      if (!isExcludedProtyle(p) && !isElementHidden(p) && getDocIdFromProtyle(p)) {
        return p
      }
    }
  }

  // 优先级 2：中心工作区 (.layout__center) 中的可见 protyle
  const centerProtyles = d.querySelectorAll?.<HTMLElement>('.layout__center .protyle')
  if (centerProtyles) {
    for (let i = 0; i < centerProtyles.length; i++) {
      const p = centerProtyles[i]
      if (!isExcludedProtyle(p) && !isElementHidden(p) && getDocIdFromProtyle(p)) {
        return p
      }
    }
  }

  // 优先级 3：全局查找主工作区可见 protyle（排除 dock/popover/dialog）
  const allProtyles = d.querySelectorAll?.<HTMLElement>('.protyle')
  if (allProtyles) {
    for (let i = 0; i < allProtyles.length; i++) {
      const p = allProtyles[i]
      if (!isExcludedProtyle(p) && !isElementHidden(p) && getDocIdFromProtyle(p)) {
        return p
      }
    }
  }

  return null
}

/**
 * 检测当前是否有光标焦点或选中块，若有则返回对应块或文档
 */
export function findFocusedBlockOrDoc(
  doc?: Document,
  win?: Window,
): ActiveBlockResult | null {
  const d = getGlobalDoc(doc)
  const w = getGlobalWin(win)

  // 1. 优先从 window.getSelection() 获取选区
  try {
    const selection = w?.getSelection?.()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const container = range.startContainer
      const targetEl = (container.nodeType === 1 /* Node.ELEMENT_NODE */
        ? container
        : container.parentElement) as HTMLElement | null
      if (targetEl) {
        const resolved = resolveBlockFromElement(targetEl)
        if (resolved)
          return resolved
      }
    }
  }
  catch {
    // 忽略选区获取异常
  }

  // 2. 检查 document.activeElement
  const activeEl = d?.activeElement as HTMLElement | null
  if (activeEl) {
    const resolved = resolveBlockFromElement(activeEl)
    if (resolved)
      return resolved
  }

  // 3. 检查当前主工作区是否有选中的块（.protyle-wysiwyg--select）
  const activeProtyle = findActiveProtyle(d)
  if (activeProtyle) {
    const selectedBlock = activeProtyle.querySelector?.<HTMLElement>(
      '.protyle-wysiwyg--select[data-node-id]',
    )
    if (selectedBlock) {
      const resolved = resolveBlockFromElement(selectedBlock)
      if (resolved)
        return resolved
    }
  }

  return null
}

/**
 * 查找当前激活的主文档
 */
export function findActiveDoc(doc?: Document): ActiveBlockResult | null {
  const d = getGlobalDoc(doc)
  if (!d)
    return null
  const protyle = findActiveProtyle(d)
  if (!protyle)
    return null
  const rootId = getDocIdFromProtyle(protyle)
  if (!rootId)
    return null
  return {
    id: rootId,
    kind: 'doc',
    rootId,
  }
}

/**
 * 首次打开侧栏时的主动解析逻辑：
 * 1. 如果当前有光标焦点则显示对应块或文档属性
 * 2. 如果没有光标焦点，默认展示当前文档的属性，而不是显示空白
 */
export function resolveInitialBlock(
  doc?: Document,
  win?: Window,
): ActiveBlockResult | null {
  const d = getGlobalDoc(doc)
  const w = getGlobalWin(win)

  const focused = findFocusedBlockOrDoc(d, w)
  if (focused)
    return focused

  const activeDoc = findActiveDoc(d)
  if (activeDoc)
    return activeDoc

  return null
}
