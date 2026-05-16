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

    <!-- 笔记本自定义属性统计 -->
    <div class="spm-stats__section">
      <div class="spm-stats__section-header">
        <span class="spm-stats__section-title">{{ t('notebookAttrStats') }}</span>
        <span v-if="!nbLoading && totalBlocks > 0" class="spm-stats__section-count">
          {{ totalBlocks }}{{ t('blockCount') }}
        </span>
      </div>
      <div v-if="nbLoading" class="spm-stats__empty">{{ t('loading') }}</div>
      <div v-else-if="groups.length === 0" class="spm-stats__empty">{{ t('noNotebookStats') }}</div>
      <div v-else class="spm-stats__card-grid">
        <div v-for="group in groups" :key="group.name" class="spm-stats__card">
          <div class="spm-stats__card-header">
            <span class="spm-stats__card-name">{{ group.name.slice(prefixLen) }}</span>
            <span class="spm-stats__card-count">
              {{ group.values.length }}{{ t('valueCount') }}
            </span>
          </div>
          <div class="spm-stats__card-values">
            <div
              v-for="val in visibleValues(group)"
              :key="val.value"
              class="spm-stats__value-row"
            >
              <span class="spm-stats__value-text" :title="val.value">{{ val.value || '·' }}</span>
              <span class="spm-stats__value-count">{{ val.count }}</span>
            </div>
          </div>
          <button
            v-if="group.values.length > defaultVisible"
            class="spm-stats__expand-btn"
            @click="toggleExpand(group.name)"
          >
            {{ expandedSet.has(group.name) ? t('collapse') : t('expandAll') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref } from 'vue'
import { openTab } from 'siyuan'
import type { AttrStatGroup, DocBlockWithAttrs } from '@/composables/useAttrStats'
import { useDocCustomBlocks, useNotebookAttrStats } from '@/composables/useAttrStats'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { isDocOpened, scrollOpenedDocToBlock, scrollOpenedDocToTop, shouldFallbackToDocTop } from '@/utils/blockJump'
import { shortBlockId } from '@/utils/dom'

const props = defineProps<{
  rootId: string | null
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const prefixLen = CUSTOM_KEY_PREFIX.length
const defaultVisible = 5

const rootIdRef = computed(() => props.rootId)

const { blocks: docBlocks, loading: docLoading } = useDocCustomBlocks(rootIdRef)
const { groups, totalBlocks, loading: nbLoading } = useNotebookAttrStats(rootIdRef)

const expandedSet = ref(new Set<string>())

function toggleExpand(name: string) {
  if (expandedSet.value.has(name))
    expandedSet.value.delete(name)
  else
    expandedSet.value.add(name)
}

function visibleValues(group: AttrStatGroup) {
  if (expandedSet.value.has(group.name))
    return group.values
  return group.values.slice(0, defaultVisible)
}

function jumpToBlock(block: DocBlockWithAttrs) {
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

  const targetId = block.type === 'd' ? block.rootId : block.id
  openTab({
    app: plugin!.app,
    doc: { id: targetId, action: ['cb-get-focus'] },
  })
}

function jumpToDoc(rootId: string) {
  if (!scrollOpenedDocToTop(rootId)) {
    openTab({
      app: plugin!.app,
      doc: { id: rootId, action: ['cb-get-focus'] },
    })
  }
}
</script>
