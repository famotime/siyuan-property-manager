<template>
  <div class="spm-database spm-stats">
    <!-- 自定义属性模板归类 -->
    <AttrTemplateGroups :root-id="rootId" :block-id="blockId" />

    <!-- 笔记本数据库统计 -->
    <NotebookDbStats :root-id="rootId" :block-id="blockId" @jump-to-block="jumpToBlock" />
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject } from 'vue'
import type { DocBlockWithAttrs } from '@/composables/useSharedStats'
import { jumpToDocBlock } from '@/composables/jumpToBlock'
import AttrTemplateGroups from './AttrTemplateGroups.vue'
import NotebookDbStats from './NotebookDbStats.vue'

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
