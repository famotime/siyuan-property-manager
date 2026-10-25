import type { App } from 'siyuan'
import { openTab } from 'siyuan'
import type { DocBlockWithAttrs } from '@/composables/useSharedStats'
import { setCurrentBlock, setPendingJumpBlockId } from '@/composables/useCurrentBlock'
import {
  highlightBlock,
  isDocOpened,
  scrollOpenedDocToBlock,
  scrollOpenedDocToTop,
  shouldFallbackToDocTop,
} from '@/utils/blockJump'

/**
 * 统计面板下钻块的跳转编排（AttrStats 与 AttrDatabase 曾逐行重复）：
 * 高亮 → 更新当前块 → 已打开文档内滚动定位（文档块回顶）→ 兜底打开文档 Tab。
 */
export function jumpToDocBlock(app: App, block: DocBlockWithAttrs): void {
  const targetId = block.type === 'd' ? block.rootId : block.id
  highlightBlock(targetId)

  const kind = block.type === 'd' ? 'doc' : 'block'
  setCurrentBlock(targetId, kind, block.rootId)

  if (block.type === 'd') {
    if (scrollOpenedDocToTop(block.rootId))
      return
  }

  const docOpened = isDocOpened(block.rootId)
  const blockFound = scrollOpenedDocToBlock(block.rootId, block.id)
  if (blockFound)
    return

  if (shouldFallbackToDocTop(blockFound, docOpened) && scrollOpenedDocToTop(block.rootId))
    return

  setPendingJumpBlockId(targetId)

  openTab({
    app,
    doc: { id: block.rootId, action: ['cb-get-focus'] },
  })
}
