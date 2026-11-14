<template>
  <AttrSection
    :title="t('notebookDbStats')"
    :tooltip="t('notebookDbStatsTooltip')"
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
            <div class="spm-db-stats__header-actions">
              <button
                class="spm-db-stats__insert-btn"
                type="button"
                :title="t('insertDatabaseToDoc')"
                :disabled="inserting === db.id"
                @click.stop="insertDatabaseView(db)"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
              </button>
              <button
                v-if="db.blocksCount > 0"
                class="spm-db-stats__sync-toggle"
                :class="{ 'spm-db-stats__sync-toggle--on': isSyncEnabled(db.id) }"
                type="button"
                :title="isSyncEnabled(db.id) ? t('avSyncDisableHint') : t('avSyncEnableHint')"
                @click.stop="toggleSync(db)"
              >
                {{ isSyncEnabled(db.id) ? t('avSyncOn') : t('avSyncOff') }}
              </button>
            </div>
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
              <span
                v-if="db.detachedCount > 0"
                class="spm-db-stats__meta-item spm-db-stats__meta-item--detached"
                :title="t('avSyncDetachedHint')"
              >
                <span class="spm-db-stats__meta-label">{{ t('avSyncDetached') }}:</span>
                <span class="spm-db-stats__meta-val">{{ db.detachedCount }}</span>
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
            <!-- 双向同步：状态与手动对账 -->
            <div v-if="db.blocksCount > 0 && isSyncEnabled(db.id)" class="spm-db-stats__sync-row">
              <span class="spm-db-stats__sync-status" :title="syncStatusText(db.id)">
                {{ syncStatusText(db.id) }}
              </span>
              <button
                class="spm-db-stats__sync-btn"
                type="button"
                :disabled="syncStatusOf(db.id).state === 'syncing'"
                @click.stop="syncNow(db)"
              >
                {{ syncStatusOf(db.id).state === 'syncing' ? t('avSyncRunning') : t('avSyncNow') }}
              </button>
            </div>
          </div>

          <!-- 卡片展开的绑定块列表 -->
          <BlockListDrilldown
            :visible="expandedDbKeys.has(db.id)"
            :cache="bindingBlocksCache[db.id]"
            :max-content="10"
            :empty-text="t('noBindingBlocks')"
            container-class="spm-db-stats__blocks-container"
            @copy="copyText"
            @jump="jumpToSubBlock"
          />
        </div>
      </div>
    </div>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref } from 'vue'
import { showMessage } from 'siyuan'
import type { AvSyncStatus } from '@/types/avSync'
import { useNotebookDbStats } from '@/composables/useNotebookDbStats'
import type { BindingBlockInfo, DbStatsInfo } from '@/composables/useNotebookDbStats'
import { useAvSync } from '@/composables/useAvSync'
import { insertBlock } from '@/api'
import { highlightBlock, scrollOpenedDocToBlock } from '@/utils/blockJump'
import AttrSection from './AttrSection.vue'
import BlockListDrilldown from './BlockListDrilldown.vue'
import { copyTextToClipboard } from '@/utils/clipboard'

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

const { status, isEnabled, setEnabled, syncNow: runSyncNow } = useAvSync()

function isSyncEnabled(avID: string): boolean {
  return isEnabled(avID)
}

function syncStatusOf(avID: string): AvSyncStatus {
  return status.value[avID] ?? { state: 'idle' }
}

function syncStatusText(avID: string): string {
  const current = syncStatusOf(avID)
  if (current.state === 'syncing')
    return t('avSyncRunning')
  if (current.state === 'error')
    return `${t('avSyncFailed')}: ${current.message ?? ''}`
  if (current.state === 'done') {
    return t('avSyncDone')
      .replace('{written}', String(current.written ?? 0))
      .replace('{skipped}', String(current.skipped ?? 0))
  }
  return t('avSyncIdle')
}

function toggleSync(db: DbStatsInfo) {
  const next = !isSyncEnabled(db.id)
  setEnabled(db.id, next, db.name)
  if (next)
    showMessage(t('avSyncEnabledToast'), 3000)
}

async function syncNow(db: DbStatsInfo) {
  const result = await runSyncNow(db.id)
  if (result.error) {
    showMessage(`${t('avSyncFailed')}: ${result.error}`, 5000, 'error')
    return
  }
  showMessage(
    t('avSyncResult')
      .replace('{toAv}', String(result.toAv))
      .replace('{toIal}', String(result.toIal))
      .replace('{skipped}', String(result.skipped)),
    3000,
  )
}

async function toggleDbExpand(db: DbStatsInfo) {
  if (expandedDbKeys.value.has(db.id)) {
    expandedDbKeys.value.delete(db.id)
  } else {
    expandedDbKeys.value.add(db.id)
    await loadBindingBlocks(db.id, db.bindingBlockIds)
  }
}

function copyText(text: string) {
  void copyTextToClipboard(text)
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

const inserting = ref<string | null>(null)

async function insertDatabaseView(db: DbStatsInfo) {
  if (inserting.value)
    return

  const targetDocId = props.rootId
  const previousID = (props.blockId && props.blockId !== props.rootId) ? props.blockId : undefined
  const parentID = previousID ? undefined : (targetDocId || undefined)

  if (!previousID && !parentID) {
    showMessage(t('insertContextMissing'), 4000, 'error')
    return
  }

  inserting.value = db.id
  try {
    const insertResult = await insertBlock({
      dataType: 'dom',
      data: `<div data-type="NodeAttributeView" data-av-id="${db.id}" data-av-type="table"></div>`,
      previousID,
      parentID,
    })

    if (!insertResult)
      throw new Error(t('insertDatabaseBlockFailed'))

    showMessage(t('insertDatabaseSuccess'), 3000)

    const op = Array.isArray(insertResult)
      ? insertResult[0]?.doOperations?.[0]
      : (insertResult as any)?.doOperations?.[0]
    const newBlockId = op?.id

    if (newBlockId && targetDocId) {
      setTimeout(() => {
        scrollOpenedDocToBlock(targetDocId, newBlockId)
        highlightBlock(newBlockId)
      }, 150)
    }
  }
  catch (err: any) {
    showMessage(err?.message || t('createDatabaseFailed'), 5000, 'error')
  }
  finally {
    inserting.value = null
  }
}
</script>
