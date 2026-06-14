import type { Plugin } from 'siyuan'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { findBlockIdFromEvent } from '@/utils/dom'
import { nextCurrentBlockState } from '@/utils/currentBlockState'
import { highlightBlock, scrollOpenedDocToBlock } from '@/utils/blockJump'

type BlockKind = 'doc' | 'block'

interface ProtyleLike {
  block?: { rootID?: string }
}

interface EditorClickDetail {
  protyle: ProtyleLike
  event: MouseEvent
}

interface SwitchProtyleDetail {
  protyle: ProtyleLike
}

interface DestroyProtyleDetail {
  protyle: ProtyleLike
}

const currentBlockId = ref<BlockId | null>(null)
const currentBlockKind = ref<BlockKind | null>(null)
const currentRootId = ref<BlockId | null>(null)

let bound = false
let boundPlugin: Plugin | null = null
let pendingRaf = 0
let pendingId: { id: BlockId, kind: BlockKind } | null = null
let pendingJumpBlockId: BlockId | null = null

function setBlock(id: BlockId | null, kind: BlockKind | null) {
  const next = nextCurrentBlockState(
    {
      blockId: currentBlockId.value,
      blockKind: currentBlockKind.value,
      rootId: currentRootId.value,
    },
    { id, kind },
  )

  if (next.blockId === currentBlockId.value
    && next.blockKind === currentBlockKind.value
    && next.rootId === currentRootId.value) {
    return
  }

  currentBlockId.value = next.blockId
  currentBlockKind.value = next.blockKind
  currentRootId.value = next.rootId
}

function scheduleUpdate(next: { id: BlockId, kind: BlockKind }) {
  pendingId = next
  if (pendingRaf)
    return
  pendingRaf = requestAnimationFrame(() => {
    pendingRaf = 0
    if (!pendingId)
      return
    const { id, kind } = pendingId
    pendingId = null
    setBlock(id, kind)
  })
}

// 防止 onDocumentClick 与 onEditorClick 在同一次点击中重复调度
let editorClickHandled = false

function onEditorClick(e: CustomEvent<EditorClickDetail>) {
  editorClickHandled = true
  queueMicrotask(() => { editorClickHandled = false })
  const rootId = e.detail.protyle?.block?.rootID
  if (rootId)
    currentRootId.value = rootId
  const resolved = findBlockIdFromEvent(e.detail.event, rootId)
  if (!resolved)
    return
  scheduleUpdate(resolved)
}

function onSwitchProtyle(e: CustomEvent<SwitchProtyleDetail>) {
  const rootId = e.detail.protyle?.block?.rootID
  if (!rootId)
    return
  
  const isSameDoc = rootId === currentRootId.value
  currentRootId.value = rootId
  
  if (pendingJumpBlockId) {
    const targetId = pendingJumpBlockId
    pendingJumpBlockId = null
    
    // 跨文档跳转页签打开后，在目标页签渲染过程中轮询尝试定位与高亮
    let attempts = 0
    const maxAttempts = 20
    const tryScrollAndHighlight = () => {
      const success = scrollOpenedDocToBlock(rootId, targetId)
      if (success) {
        highlightBlock(targetId)
        return
      }
      attempts++
      if (attempts < maxAttempts) {
        setTimeout(tryScrollAndHighlight, 100)
      }
    }
    tryScrollAndHighlight()

    scheduleUpdate({ id: rootId, kind: 'doc' })
    requestAnimationFrame(() => {
      if (currentRootId.value === rootId) {
        setBlock(targetId, targetId === rootId ? 'doc' : 'block')
      }
    })
    return
  }

  const hasSpecificBlock = currentBlockId.value && currentBlockId.value !== currentRootId.value
  if (isSameDoc && hasSpecificBlock) {
    return
  }

  scheduleUpdate({ id: rootId, kind: 'doc' })
}

function onLoadedStatic(e: CustomEvent<SwitchProtyleDetail>) {
  const rootId = e.detail.protyle?.block?.rootID
  if (!rootId)
    return
  currentRootId.value = rootId
  // 文档首次加载时若面板还没有任何块，自动展示文档块
  if (!currentBlockId.value)
    scheduleUpdate({ id: rootId, kind: 'doc' })
}

function onDestroyProtyle(e: CustomEvent<DestroyProtyleDetail>) {
  const rootId = e.detail.protyle?.block?.rootID
  if (!rootId)
    return
  if (rootId === currentRootId.value) {
    currentRootId.value = null
    if (currentBlockKind.value === 'doc' && currentBlockId.value === rootId)
      setBlock(null, null)
  }
}

/**
 * 兜底：监听文档标题区域的点击。
 * click-editorcontent 在标题点击时不一定触发或 rootID 可能为空，
 * 因此通过 document click 委托捕获 .protyle-title 内的点击。
 */
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target || !target.closest('.protyle-title'))
    return
  // 若 click-editorcontent 已在本次点击中处理，跳过
  if (editorClickHandled)
    return
  // 延迟到下一帧，给 click-editorcontent 同步触发留出机会
  requestAnimationFrame(() => {
    if (editorClickHandled)
      return
    const el = target.closest<HTMLElement>('.protyle')
    const rootId = el?.getAttribute('data-doc-id')
      ?? el?.querySelector<HTMLElement>('.protyle-title')?.getAttribute('data-node-id')
    if (rootId)
      scheduleUpdate({ id: rootId, kind: 'doc' })
  })
}

function bind(plugin: Plugin) {
  if (bound)
    return
  bound = true
  boundPlugin = plugin
  const bus = plugin.eventBus
  bus.on('click-editorcontent', onEditorClick)
  bus.on('switch-protyle', onSwitchProtyle)
  bus.on('loaded-protyle-static', onLoadedStatic)
  bus.on('destroy-protyle', onDestroyProtyle)
  document.addEventListener('click', onDocumentClick, true)
}

function unbind() {
  if (!bound || !boundPlugin)
    return
  const bus = boundPlugin.eventBus
  bus.off('click-editorcontent', onEditorClick)
  bus.off('switch-protyle', onSwitchProtyle)
  bus.off('loaded-protyle-static', onLoadedStatic)
  bus.off('destroy-protyle', onDestroyProtyle)
  document.removeEventListener('click', onDocumentClick, true)
  if (pendingRaf) {
    cancelAnimationFrame(pendingRaf)
    pendingRaf = 0
    pendingId = null
  }
  bound = false
  boundPlugin = null
  setBlock(null, null)
  currentRootId.value = null
}

export interface UseCurrentBlock {
  currentBlockId: Ref<BlockId | null>
  currentBlockKind: Ref<BlockKind | null>
  currentRootId: Ref<BlockId | null>
  dispose: () => void
}

export function useCurrentBlock(plugin: Plugin): UseCurrentBlock {
  bind(plugin)
  return {
    currentBlockId,
    currentBlockKind,
    currentRootId,
    dispose: unbind,
  }
}

export function setPendingJumpBlockId(id: BlockId | null) {
  pendingJumpBlockId = id
}

export function setCurrentBlock(id: BlockId | null, kind: BlockKind | null, rootId?: BlockId | null) {
  setBlock(id, kind)
  if (rootId) {
    currentRootId.value = rootId
  }
}
