import type { Plugin } from 'siyuan'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { findBlockIdFromEvent } from '@/utils/dom'

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

function setBlock(id: BlockId | null, kind: BlockKind | null) {
  if (id === currentBlockId.value && kind === currentBlockKind.value)
    return
  currentBlockId.value = id
  currentBlockKind.value = kind
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

function onEditorClick(e: CustomEvent<EditorClickDetail>) {
  const rootId = e.detail.protyle?.block?.rootID
  if (rootId)
    currentRootId.value = rootId
  const resolved = findBlockIdFromEvent(e.detail.event, rootId)
  if (!resolved)
    return
  // 当 id 与当前一致时直接跳过，避免点击同块时频繁触发响应式更新
  if (resolved.id === currentBlockId.value && resolved.kind === currentBlockKind.value)
    return
  scheduleUpdate(resolved)
}

function onSwitchProtyle(e: CustomEvent<SwitchProtyleDetail>) {
  const rootId = e.detail.protyle?.block?.rootID
  if (!rootId)
    return
  currentRootId.value = rootId
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
}

function unbind() {
  if (!bound || !boundPlugin)
    return
  const bus = boundPlugin.eventBus
  bus.off('click-editorcontent', onEditorClick)
  bus.off('switch-protyle', onSwitchProtyle)
  bus.off('loaded-protyle-static', onLoadedStatic)
  bus.off('destroy-protyle', onDestroyProtyle)
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
