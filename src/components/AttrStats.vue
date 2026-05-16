<template>
  <div class="spm-stats">
    <!-- 文档自定义属性块 -->
    <div class="spm-stats__section">
      <div class="spm-stats__section-header">
        <span class="spm-stats__section-title">{{ t('docCustomBlocks') }}</span>
        <span v-if="!docLoading" class="spm-stats__section-count">{{ docBlocks.length }}</span>
      </div>
      <div v-if="docLoading" class="spm-stats__empty">{{ t('loading') }}</div>
      <div v-else-if="docBlocks.length === 0" class="spm-stats__empty">{{ t('noCustomBlocks') }}</div>
      <div v-else class="spm-stats__block-list">
        <div
          v-for="block in docBlocks"
          :key="block.id"
          class="spm-stats__block-item"
          :title="t('clickToJump')"
          @click="jumpToBlock(block)"
        >
          <div class="spm-stats__block-head">
            <span class="spm-stats__block-type">{{ block.type }}</span>
            <code class="spm-stats__block-id">{{ shortBlockId(block.id) }}</code>
          </div>
          <div class="spm-stats__block-content">{{ block.content || t('emptyValue') }}</div>
          <div class="spm-stats__block-attrs">
            <span
              v-for="attr in block.attrs"
              :key="attr.key"
              class="spm-stats__attr-tag"
            >
              {{ attr.key.slice(prefixLen) }}={{ attr.value || '·' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 笔记本属性统计 -->
    <div class="spm-stats__section">
      <div class="spm-stats__section-header">
        <span class="spm-stats__section-title">{{ t('notebookStats') }}</span>
        <span v-if="!nbLoading && totalBlocks > 0" class="spm-stats__section-count">
          {{ totalBlocks }}{{ t('blockCount') }}
        </span>
      </div>
      <div v-if="nbLoading" class="spm-stats__empty">{{ t('loading') }}</div>
      <div v-else-if="docs.length === 0" class="spm-stats__empty">{{ t('noNotebookStats') }}</div>
      <div v-else class="spm-stats__doc-list">
        <div
          v-for="doc in docs"
          :key="doc.rootId"
          class="spm-stats__doc-item"
          @click="jumpToDoc(doc.rootId)"
        >
          <span class="spm-stats__doc-title" :title="doc.title">{{ doc.title }}</span>
          <span class="spm-stats__doc-count">{{ doc.blockCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject } from 'vue'
import { openTab } from 'siyuan'
import type { DocBlockWithAttrs } from '@/composables/useAttrStats'
import { useDocCustomBlocks, useNotebookAttrStats } from '@/composables/useAttrStats'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { shortBlockId } from '@/utils/dom'

const props = defineProps<{
  rootId: string | null
  boxId: string | null
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const prefixLen = CUSTOM_KEY_PREFIX.length

const rootIdRef = computed(() => props.rootId)
const boxIdRef = computed(() => props.boxId)

const { blocks: docBlocks, loading: docLoading } = useDocCustomBlocks(rootIdRef)
const { docs, totalBlocks, loading: nbLoading } = useNotebookAttrStats(boxIdRef)

function jumpToBlock(block: DocBlockWithAttrs) {
  // 文档块：打开文档标题位置；普通块：聚焦到该块
  const targetId = block.type === 'd' ? block.rootId : block.id
  openTab({
    app: plugin!.app,
    doc: { id: targetId, action: ['cb-get-focus'] },
  })
}

function jumpToDoc(rootId: string) {
  openTab({
    app: plugin!.app,
    doc: { id: rootId, action: ['cb-get-focus'] },
  })
}
</script>
