import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findActiveDoc,
  findActiveProtyle,
  findFocusedBlockOrDoc,
  getDocIdFromProtyle,
  isElementHidden,
  isExcludedProtyle,
  resolveBlockFromElement,
  resolveInitialBlock,
} from '../src/utils/activeBlock.ts'

// ---- 极简 Mock DOM 用于 Node.js 测试环境 ----

interface MockNodeOptions {
  tagName?: string
  className?: string
  attributes?: Record<string, string>
  children?: MockNode[]
  nodeType?: number
}

class MockNode {
  tagName: string
  className: string
  attributes: Map<string, string>
  children: MockNode[]
  parentElement: MockNode | null = null
  nodeType: number

  constructor(options: MockNodeOptions = {}) {
    this.tagName = (options.tagName || 'div').toUpperCase()
    this.className = options.className || ''
    this.attributes = new Map(Object.entries(options.attributes || {}))
    this.children = []
    this.nodeType = options.nodeType ?? 1 // 1: Element, 3: Text

    if (options.children) {
      for (const child of options.children) {
        this.appendChild(child)
      }
    }
  }

  get classList() {
    const classes = new Set(this.className.split(/\s+/).filter(Boolean))
    return {
      contains: (cls: string) => classes.has(cls),
      add: (cls: string) => {
        classes.add(cls)
        this.className = Array.from(classes).join(' ')
      },
      remove: (cls: string) => {
        classes.delete(cls)
        this.className = Array.from(classes).join(' ')
      },
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  appendChild(child: MockNode) {
    child.parentElement = this
    this.children.push(child)
  }

  closest(selector: string): MockNode | null {
    const selectors = selector.split(',').map(s => s.trim())
    let curr: MockNode | null = this
    while (curr) {
      for (const sel of selectors) {
        if (curr.matches(sel))
          return curr
      }
      curr = curr.parentElement
    }
    return null
  }

  matches(sel: string): boolean {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1)
      return this.classList.contains(cls)
    }
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const attrMatch = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(sel)
      if (attrMatch) {
        const [, attr, val] = attrMatch
        if (val !== undefined) {
          return this.getAttribute(attr) === val
        }
        return this.attributes.has(attr)
      }
    }
    return false
  }

  querySelector(selector: string): MockNode | null {
    const results = this.querySelectorAll(selector)
    return results.length > 0 ? results[0] : null
  }

  querySelectorAll(selector: string): MockNode[] {
    const selectors = selector.split(',').map(s => s.trim())
    const results: MockNode[] = []

    for (const singleSel of selectors) {
      const parts = singleSel.split(/\s+/).filter(Boolean)
      const matchesInSubtree = (node: MockNode, partIndex: number) => {
        const currentPart = parts[partIndex]
        const isMatch = node.matchesCompound(currentPart)
        if (isMatch) {
          if (partIndex === parts.length - 1) {
            if (!results.includes(node))
              results.push(node)
            return
          }
          for (const child of node.children) {
            matchesInSubtree(child, partIndex + 1)
          }
        }
        for (const child of node.children) {
          matchesInSubtree(child, partIndex)
        }
      }

      for (const child of this.children) {
        matchesInSubtree(child, 0)
      }
    }

    return results
  }

  matchesCompound(part: string): boolean {
    // 匹配如 .layout__wnd--active 或 .protyle:not(.fn__none) 或 [data-node-id] 或 .item[attr]
    let remaining = part
    const tagMatch = /^([a-zA-Z0-9_-]+)/.exec(remaining)
    if (tagMatch) {
      if (this.tagName !== tagMatch[1].toUpperCase())
        return false
      remaining = remaining.slice(tagMatch[1].length)
    }

    while (remaining.length > 0) {
      if (remaining.startsWith(':not(')) {
        const endIdx = remaining.indexOf(')')
        const inner = remaining.slice(5, endIdx)
        if (this.matchesCompound(inner))
          return false
        remaining = remaining.slice(endIdx + 1)
      }
      else if (remaining.startsWith('.')) {
        const clsMatch = /^\.([a-zA-Z0-9_-]+)/.exec(remaining)
        if (!clsMatch)
          break
        if (!this.classList.contains(clsMatch[1]))
          return false
        remaining = remaining.slice(clsMatch[0].length)
      }
      else if (remaining.startsWith('[')) {
        const attrMatch = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]/.exec(remaining)
        if (!attrMatch)
          break
        const [, attr, val] = attrMatch
        if (val !== undefined) {
          if (this.getAttribute(attr) !== val)
            return false
        }
        else if (!this.attributes.has(attr)) {
          return false
        }
        remaining = remaining.slice(attrMatch[0].length)
      }
      else {
        break
      }
    }

    return true
  }
}

// ---- 辅助函数：构造测试用的 DOM 树 ----

function createMockDocument(root: MockNode) {
  return {
    querySelector: (sel: string) => root.querySelector(sel),
    querySelectorAll: (sel: string) => root.querySelectorAll(sel),
    activeElement: null as MockNode | null,
  } as unknown as Document
}

function createMockWindow(selectionNode: MockNode | null = null) {
  return {
    getSelection: () => {
      if (!selectionNode)
        return { rangeCount: 0 }
      return {
        rangeCount: 1,
        getRangeAt: () => ({
          startContainer: selectionNode,
        }),
      }
    },
  } as unknown as Window
}

// ---- 测试开始 ----

test('isExcludedProtyle identifies excluded containers', () => {
  const dock = new MockNode({ className: 'spm-dock' })
  const protyleInDock = new MockNode({ className: 'protyle' })
  dock.appendChild(protyleInDock)
  assert.equal(isExcludedProtyle(protyleInDock as unknown as HTMLElement), true)

  const popover = new MockNode({ className: 'protyle-popover' })
  const protyleInPopover = new MockNode({ className: 'protyle' })
  popover.appendChild(protyleInPopover)
  assert.equal(isExcludedProtyle(protyleInPopover as unknown as HTMLElement), true)

  const mainEditor = new MockNode({ className: 'layout__center' })
  const protyleNormal = new MockNode({ className: 'protyle' })
  mainEditor.appendChild(protyleNormal)
  assert.equal(isExcludedProtyle(protyleNormal as unknown as HTMLElement), false)
})

test('isElementHidden detects fn__none on element or ancestor', () => {
  const hiddenSelf = new MockNode({ className: 'protyle fn__none' })
  assert.equal(isElementHidden(hiddenSelf as unknown as HTMLElement), true)

  const hiddenParent = new MockNode({ className: 'fn__none' })
  const child = new MockNode({ className: 'protyle' })
  hiddenParent.appendChild(child)
  assert.equal(isElementHidden(child as unknown as HTMLElement), true)

  const visible = new MockNode({ className: 'protyle' })
  assert.equal(isElementHidden(visible as unknown as HTMLElement), false)
})

test('getDocIdFromProtyle resolves id from data-doc-id or title node-id', () => {
  const p1 = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-123' } })
  assert.equal(getDocIdFromProtyle(p1 as unknown as HTMLElement), 'doc-123')

  const p2 = new MockNode({ className: 'protyle' })
  const title = new MockNode({ className: 'protyle-title', attributes: { 'data-node-id': 'doc-title-456' } })
  p2.appendChild(title)
  assert.equal(getDocIdFromProtyle(p2 as unknown as HTMLElement), 'doc-title-456')
})

test('resolveBlockFromElement resolves block when inside [data-node-id]', () => {
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-1' } })
  const block = new MockNode({ attributes: { 'data-node-id': 'block-2' } })
  const textChild = new MockNode({ nodeType: 3 })
  block.appendChild(textChild)
  protyle.appendChild(block)

  const res = resolveBlockFromElement(textChild as unknown as HTMLElement)
  assert.deepEqual(res, {
    id: 'block-2',
    kind: 'block',
    rootId: 'doc-1',
  })
})

test('resolveBlockFromElement resolves doc when node is in protyle-title', () => {
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-1' } })
  const title = new MockNode({ className: 'protyle-title' })
  const titleText = new MockNode({ nodeType: 3 })
  title.appendChild(titleText)
  protyle.appendChild(title)

  const res = resolveBlockFromElement(titleText as unknown as HTMLElement)
  assert.deepEqual(res, {
    id: 'doc-1',
    kind: 'doc',
    rootId: 'doc-1',
  })
})

test('resolveBlockFromElement resolves doc when block id matches root id', () => {
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-1' } })
  const block = new MockNode({ attributes: { 'data-node-id': 'doc-1' } })
  protyle.appendChild(block)

  const res = resolveBlockFromElement(block as unknown as HTMLElement)
  assert.deepEqual(res, {
    id: 'doc-1',
    kind: 'doc',
    rootId: 'doc-1',
  })
})

test('findFocusedBlockOrDoc resolves from window selection', () => {
  const root = new MockNode()
  const center = new MockNode({ className: 'layout__center' })
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-focus' } })
  const block = new MockNode({ attributes: { 'data-node-id': 'block-cursor' } })
  const text = new MockNode({ nodeType: 3 })
  block.appendChild(text)
  protyle.appendChild(block)
  center.appendChild(protyle)
  root.appendChild(center)

  const mockDoc = createMockDocument(root)
  const mockWin = createMockWindow(text)

  const focused = findFocusedBlockOrDoc(mockDoc, mockWin)
  assert.deepEqual(focused, {
    id: 'block-cursor',
    kind: 'block',
    rootId: 'doc-focus',
  })
})

test('findFocusedBlockOrDoc resolves from document activeElement when no selection', () => {
  const root = new MockNode()
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-active-el' } })
  const block = new MockNode({ attributes: { 'data-node-id': 'block-active' } })
  protyle.appendChild(block)
  root.appendChild(protyle)

  const mockDoc = createMockDocument(root)
  ;(mockDoc as any).activeElement = block
  const mockWin = createMockWindow(null)

  const focused = findFocusedBlockOrDoc(mockDoc, mockWin)
  assert.deepEqual(focused, {
    id: 'block-active',
    kind: 'block',
    rootId: 'doc-active-el',
  })
})

test('findFocusedBlockOrDoc resolves from protyle-wysiwyg--select element', () => {
  const root = new MockNode()
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-sel' } })
  const selectedBlock = new MockNode({
    className: 'protyle-wysiwyg--select',
    attributes: { 'data-node-id': 'block-multi-selected' },
  })
  protyle.appendChild(selectedBlock)
  root.appendChild(protyle)

  const mockDoc = createMockDocument(root)
  const mockWin = createMockWindow(null)

  const focused = findFocusedBlockOrDoc(mockDoc, mockWin)
  assert.deepEqual(focused, {
    id: 'block-multi-selected',
    kind: 'block',
    rootId: 'doc-sel',
  })
})

test('findActiveDoc picks active split window (.layout__wnd--active) over inactive one', () => {
  const root = new MockNode()
  const center = new MockNode({ className: 'layout__center' })

  // 窗口 1（非激活）
  const wnd1 = new MockNode({ className: 'layout__wnd' })
  const protyle1 = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-inactive-wnd' } })
  wnd1.appendChild(protyle1)

  // 窗口 2（激活窗口）
  const wnd2 = new MockNode({ className: 'layout__wnd layout__wnd--active' })
  const protyle2 = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-active-wnd' } })
  wnd2.appendChild(protyle2)

  center.appendChild(wnd1)
  center.appendChild(wnd2)
  root.appendChild(center)

  const mockDoc = createMockDocument(root)
  const activeDoc = findActiveDoc(mockDoc)
  assert.deepEqual(activeDoc, {
    id: 'doc-active-wnd',
    kind: 'doc',
    rootId: 'doc-active-wnd',
  })
})

test('findActiveDoc ignores hidden tabs with fn__none', () => {
  const root = new MockNode()
  const center = new MockNode({ className: 'layout__center' })

  // 隐藏 Tab
  const hiddenProtyle = new MockNode({ className: 'protyle fn__none', attributes: { 'data-doc-id': 'doc-hidden' } })
  // 可见 Tab
  const visibleProtyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-visible' } })

  center.appendChild(hiddenProtyle)
  center.appendChild(visibleProtyle)
  root.appendChild(center)

  const mockDoc = createMockDocument(root)
  const activeDoc = findActiveDoc(mockDoc)
  assert.deepEqual(activeDoc, {
    id: 'doc-visible',
    kind: 'doc',
    rootId: 'doc-visible',
  })
})

test('resolveInitialBlock returns focused block when cursor exists', () => {
  const root = new MockNode()
  const center = new MockNode({ className: 'layout__center' })
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-target' } })
  const block = new MockNode({ attributes: { 'data-node-id': 'block-cursor-1' } })
  const text = new MockNode({ nodeType: 3 })
  block.appendChild(text)
  protyle.appendChild(block)
  center.appendChild(protyle)
  root.appendChild(center)

  const mockDoc = createMockDocument(root)
  const mockWin = createMockWindow(text)

  const result = resolveInitialBlock(mockDoc, mockWin)
  assert.deepEqual(result, {
    id: 'block-cursor-1',
    kind: 'block',
    rootId: 'doc-target',
  })
})

test('resolveInitialBlock falls back to active document when no cursor focus', () => {
  const root = new MockNode()
  const center = new MockNode({ className: 'layout__center' })
  const protyle = new MockNode({ className: 'protyle', attributes: { 'data-doc-id': 'doc-fallback-root' } })
  center.appendChild(protyle)
  root.appendChild(center)

  const mockDoc = createMockDocument(root)
  const mockWin = createMockWindow(null)

  const result = resolveInitialBlock(mockDoc, mockWin)
  assert.deepEqual(result, {
    id: 'doc-fallback-root',
    kind: 'doc',
    rootId: 'doc-fallback-root',
  })
})

test('resolveInitialBlock returns null when no documents opened at all', () => {
  const root = new MockNode()
  const mockDoc = createMockDocument(root)
  const mockWin = createMockWindow(null)

  const result = resolveInitialBlock(mockDoc, mockWin)
  assert.equal(result, null)
})
