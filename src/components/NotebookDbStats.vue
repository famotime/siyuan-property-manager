<template>
  <AttrSection
    :title="t('notebookDbStats')"
    :count="loading ? undefined : dbList.length"
    storage-key="stats-db"
    :default-open="false"
  >
    <div v-if="loading" class="spm-stats__empty">{{ t('loading') }}</div>
    <div v-else-if="error" class="spm-stats__empty spm-stats__empty--error">
      {{ t('statsLoadError') }}: {{ error }}
    </div>
    <div v-else-if="dbList.length === 0" class="spm-stats__empty">{{ t('noNotebookDbStats') }}</div>
    <div v-else class="spm-db-stats__container">
      <!-- 数据库卡片列表 -->
      <div class="spm-stats__card-grid spm-db-stats__card-grid">
        <!-- 排序选项栏 -->
        <div class="spm-stats__sort-bar">
          <span class="spm-stats__sort-label">{{ t('sortBy') }}</span>
          <select v-model="sortBy" class="spm-stats__select">
            <option value="name">{{ t('sortByDbName') }}</option>
            <option value="rows">{{ t('sortByDbRows') }}</option>
            <option value="blocks">{{ t('sortByDbBlocks') }}</option>
          </select>
          <select v-model="sortOrder" class="spm-stats__select">
            <option value="asc">{{ t('sortAscending') }}</option>
            <option value="desc">{{ t('sortDescending') }}</option>
          </select>
        </div>

        <div v-for="db in dbList" :key="db.id" class="spm-stats__card spm-db-stats__card">
          <!-- 卡片头部 -->
          <div class="spm-stats__card-header spm-db-stats__card-header">
            <span class="spm-stats__card-name spm-db-stats__card-name" :title="db.name || t('dbUnnamed')">
              {{ db.name || t('dbUnnamed') }}
            </span>
          </div>

          <!-- 卡片主要数据 -->
          <div class="spm-db-stats__card-body">
            <!-- 字段列表展示 -->
            <div v-if="db.fields" class="spm-db-stats__fields" :title="db.fields">
              {{ db.fields }}
            </div>
            <div class="spm-db-stats__meta-row">
              <span class="spm-db-stats__meta-item">
                <span class="spm-db-stats__meta-label">{{ t('dbRows') }}:</span>
                <span class="spm-db-stats__meta-val">{{ db.rowsCount }}</span>
              </span>
              <span
                class="spm-db-stats__meta-item"
                :class="{ 'spm-db-stats__meta-item--clickable': db.blocksCount > 0 }"
                @click.stop="db.blocksCount > 0 ? toggleDbExpand(db) : null"
              >
                <span class="spm-db-stats__meta-label">{{ t('dbBlocks') }}:</span>
                <span class="spm-db-stats__meta-val spm-db-stats__meta-val--blocks">{{ db.blocksCount }}</span>
                <button
                  v-if="db.blocksCount > 0"
                  class="spm-stats__value-expand-toggle spm-db-stats__expand-toggle"
                  type="button"
                  :class="{ 'spm-stats__value-expand-toggle--rotated': expandedDbKeys.has(db.id) }"
                >
                  <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </span>
            </div>
            <div class="spm-db-stats__time-row">
              <div class="spm-db-stats__time-item">
                <span class="spm-db-stats__time-label">{{ t('dbCreated') }}:</span>
                <span class="spm-db-stats__time-val">{{ db.created }}</span>
              </div>
              <div class="spm-db-stats__time-item">
                <span class="spm-db-stats__time-label">{{ t('dbUpdated') }}:</span>
                <span class="spm-db-stats__time-val">{{ db.updated }}</span>
              </div>
            </div>
          </div>

          <!-- 卡片展开的绑定块列表 -->
          <div
            v-if="expandedDbKeys.has(db.id)"
            class="spm-stats__value-blocks spm-db-stats__blocks-container"
          >
            <div
              v-if="bindingBlocksCache[db.id] === 'loading'"
              class="spm-stats__blocks-loading"
            >
              {{ t('loading') }}
            </div>
            <div
              v-else-if="Array.isArray(bindingBlocksCache[db.id])"
              class="spm-stats__blocks-list"
            >
              <div
                v-for="blk in bindingBlocksCache[db.id]"
                :key="blk.id"
                class="spm-stats__value-block-item"
              >
                <div class="spm-stats__vblock-path" :title="blk.hpath">
                  <svg class="spm-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  <span>{{ blk.hpath }}</span>
                </div>
                <div class="spm-stats__vblock-meta">
                  <code class="spm-stats__vblock-id" :title="blk.id">{{ shortBlockId(blk.id) }}</code>
                  <span class="spm-stats__vblock-content" :title="blk.content">
                    {{ blk.content ? (blk.content.slice(0, 10) + (blk.content.length > 10 ? '...' : '')) : t('emptyValue') }}
                  </span>
                  <div class="spm-stats__vblock-actions">
                    <button
                      class="spm-stats__vblock-btn"
                      type="button"
                      :title="t('copyBlockId')"
                      @click.stop="copyText(blk.id)"
                    >
                      <svg class="spm-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                    <button
                      class="spm-stats__vblock-btn"
                      type="button"
                      :title="t('jumpToBlock')"
                      @click.stop="jumpToSubBlock(blk)"
                    >
                      <svg class="spm-icon" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-if="(bindingBlocksCache[db.id] as any[]).length === 0"
                class="spm-stats__blocks-empty"
              >
                {{ t('noBindingBlocks') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref } from 'vue'
import { showMessage } from 'siyuan'
import { useNotebookDbStats } from '@/composables/useNotebookDbStats'
import type { BindingBlockInfo, DbStatsInfo } from '@/composables/useNotebookDbStats'
import { shortBlockId } from '@/utils/dom'
import AttrSection from './AttrSection.vue'

const props = defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const emit = defineEmits<{
  (e: 'jump-to-block', block: any): void
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const rootIdRef = computed(() => props.rootId)
const blockIdRef = computed(() => props.blockId)

const {
  dbList,
  loading,
  error,
  sortBy,
  sortOrder,
  bindingBlocksCache,
  loadBindingBlocks,
} = useNotebookDbStats(rootIdRef, blockIdRef)

const expandedDbKeys = ref(new Set<string>())

async function toggleDbExpand(db: DbStatsInfo) {
  if (expandedDbKeys.value.has(db.id)) {
    expandedDbKeys.value.delete(db.id)
  } else {
    expandedDbKeys.value.add(db.id)
    await loadBindingBlocks(db.id, db.bindingBlockIds)
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // ignore
  }
}

function jumpToSubBlock(blk: BindingBlockInfo) {
  if (blk.isFallback) {
    showMessage(t('blockNotFoundCannotJump'), 3000, 'error')
    return
  }
  emit('jump-to-block', {
    id: blk.id,
    rootId: blk.rootId,
    content: blk.content,
    type: blk.type,
    attrs: [],
  })
}
</script>
