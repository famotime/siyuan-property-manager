<template>
  <div class="spm-stats">
    <!-- 文档自定义属性块 -->
    <DocCustomStats
      :root-id="rootId"
      :block-id="blockId"
      @jump-to-edit="emit('jump-to-edit')"
      @jump-to-block="jumpToBlock"
    />

    <!-- 笔记本自定义属性统计 -->
    <NotebookAttrStats
      :root-id="rootId"
      :block-id="blockId"
      @jump-to-block="jumpToBlock"
    />

    <!-- 自定义属性模板归类 -->
    <AttrTemplateGroups :root-id="rootId" :block-id="blockId" />

    <!-- 笔记本数据库统计 -->
    <NotebookDbStats :root-id="rootId" :block-id="blockId" @jump-to-block="jumpToBlock" />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject } from 'vue'
import { openTab } from 'siyuan'
import type { DocBlockWithAttrs } from '@/composables/useSharedStats'
import { highlightBlock, isDocOpened, scrollOpenedDocToBlock, scrollOpenedDocToTop, shouldFallbackToDocTop } from '@/utils/blockJump'
import DocCustomStats from './DocCustomStats.vue'
import NotebookAttrStats from './NotebookAttrStats.vue'
import AttrTemplateGroups from './AttrTemplateGroups.vue'
import NotebookDbStats from './NotebookDbStats.vue'
import { setCurrentBlock, setPendingJumpBlockId } from '@/composables/useCurrentBlock'

const emit = defineEmits<{
  (e: 'jump-to-edit'): void
}>()

const props = defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function jumpToBlock(block: DocBlockWithAttrs) {
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
    app: plugin!.app,
    doc: { id: block.rootId, action: ['cb-get-focus'] },
  })
}
</script>
