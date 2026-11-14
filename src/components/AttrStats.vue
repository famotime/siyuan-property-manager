<template>
  <div class="spm-stats">
    <!-- 自定义属性模板 -->
    <AttrTemplates :on-apply="handleApplyTemplate" />

    <!-- 笔记本自定义属性统计与批量管理 -->
    <NotebookAttrStats
      :root-id="rootId"
      :block-id="blockId"
      @jump-to-block="jumpToBlock"
    />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject } from 'vue'
import type { DocBlockWithAttrs } from '@/composables/useSharedStats'
import { jumpToDocBlock } from '@/composables/jumpToBlock'
import AttrTemplates from './AttrTemplates.vue'
import NotebookAttrStats from './NotebookAttrStats.vue'

const emit = defineEmits<{
  (e: 'jump-to-block', block: DocBlockWithAttrs): void
}>()

const props = defineProps<{
  rootId: string | null
  blockId: string | null
  onApplyTemplate?: (suffixOrKey: string, value: string) => Promise<void>
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

async function handleApplyTemplate(suffixOrKey: string, value: string) {
  if (props.onApplyTemplate) {
    await props.onApplyTemplate(suffixOrKey, value)
  }
}

function jumpToBlock(block: DocBlockWithAttrs) {
  emit('jump-to-block', block)
  jumpToDocBlock(plugin!.app, block)
}
</script>
