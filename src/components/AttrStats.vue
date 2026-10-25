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
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject } from 'vue'
import type { DocBlockWithAttrs } from '@/composables/useSharedStats'
import { jumpToDocBlock } from '@/composables/jumpToBlock'
import DocCustomStats from './DocCustomStats.vue'
import NotebookAttrStats from './NotebookAttrStats.vue'

const emit = defineEmits<{
  (e: 'jump-to-edit'): void
}>()

defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function jumpToBlock(block: DocBlockWithAttrs) {
  jumpToDocBlock(plugin!.app, block)
}
</script>
