<template>
  <AttrSection
    :title="t('templateGrouping')"
    :tooltip="t('templateGroupingTooltip')"
    storage-key="stats-template-groups"
    :default-open="false"
  >
    <div v-if="templates.length === 0" class="spm-stats__empty">
      {{ t('templatesEmpty') }}
    </div>
    <div v-else class="spm-template-groups">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="spm-template-groups__card"
      >
        <!-- 模板头部 -->
        <div class="spm-template-groups__card-header">
          <span class="spm-template-groups__card-title">{{ tpl.name }}</span>
          <span class="spm-template-groups__card-badge">
            {{ tpl.attrs.length }}{{ t('addProperty').replace(t('addProperty'), '') }}
          </span>
          <button
            class="spm-template-groups__filter-btn"
            type="button"
            @click="toggleFilter(tpl)"
          >
            {{ t('filterBlocks') }}
          </button>
        </div>

        <!-- 模板属性只读列表与排序 -->
        <div class="spm-template-groups__attrs-list">
          <div
            v-for="(attr, index) in tpl.attrs"
            :key="attr.key"
            class="spm-template-groups__attr-item"
          >
            <span class="spm-template-groups__attr-key" :title="attr.key">
              {{ attr.key.startsWith(CUSTOM_KEY_PREFIX) ? attr.key.slice(CUSTOM_KEY_PREFIX.length) : attr.key }}
            </span>
            <span class="spm-template-groups__attr-val" :title="attr.value || '·'">
              {{ attr.value || '·' }}
            </span>
            <!-- 排序按钮 -->
            <div class="spm-template-groups__sort-actions">
              <button
                class="spm-template-groups__sort-btn"
                type="button"
                :disabled="index === 0"
                @click="moveAttr(tpl.id, index, -1)"
                :title="t('moveUp')"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              <button
                class="spm-template-groups__sort-btn"
                type="button"
                :disabled="index === tpl.attrs.length - 1"
                @click="moveAttr(tpl.id, index, 1)"
                :title="t('moveDown')"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 筛选结果展示区 -->
        <div
          v-if="activeFilterTplId === tpl.id"
          class="spm-template-groups__filter-area"
        >
          <!-- 筛选控制栏 -->
          <div class="spm-template-groups__control-bar">
            <!-- 范围选择 -->
            <div class="spm-template-groups__range-select">
              <span class="spm-template-groups__label">{{ t('searchRange') }}:</span>
              <select
                v-model="searchScope"
                class="spm-stats__select"
                @change="runFilter(tpl)"
              >
                <option value="notebook">{{ t('currentNotebook') }}</option>
                <option value="doc">{{ t('currentDocOnly') }}</option>
              </select>
            </div>
            <!-- 全选框 -->
            <label v-if="filteredBlocks.length > 0" class="spm-template-groups__select-all">
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isPartiallySelected"
                @change="toggleSelectAll"
              >
              <span>{{ t('selectAll') }}</span>
            </label>
          </div>

          <!-- 加载中 -->
          <div v-if="filterLoading" class="spm-stats__empty">
            {{ t('loading') }}
          </div>

          <!-- 筛选结果为空 -->
          <div v-else-if="filteredBlocks.length === 0" class="spm-stats__empty">
            {{ t('noMatchedBlocks') }}
          </div>

          <!-- 筛选列表 -->
          <div v-else class="spm-template-groups__block-list">
            <div
              v-for="block in filteredBlocks"
              :key="block.id"
              class="spm-template-groups__block-item"
              @click="jumpToBlock(block)"
            >
              <div class="spm-template-groups__block-head">
                <input
                  type="checkbox"
                  class="spm-template-groups__block-checkbox"
                  :checked="selectedBlockIds.has(block.id)"
                  @change.stop="toggleSelectBlock(block.id)"
                >
                <span class="spm-stats__block-type">{{ block.type }}</span>
                <code class="spm-stats__block-id">{{ shortBlockId(block.id) }}</code>
              </div>
              <div class="spm-template-groups__block-content" :title="block.content">
                {{ block.content || t('emptyBlockContent') }}
              </div>
              <div class="spm-template-groups__block-path" :title="block.hpath">
                {{ block.hpath }}
              </div>
            </div>

            <!-- 创建数据库按钮 -->
            <div class="spm-template-groups__action-bar">
              <button
                class="spm-template-groups__db-btn"
                type="button"
                :disabled="selectedBlockIds.size === 0 || creatingDb"
                @click="createDatabaseFromSelection(tpl)"
              >
                {{ creatingDb ? t('savingHint') : t('createDatabase') }} ({{ selectedBlockIds.size }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref, watch } from 'vue'
import { showMessage } from 'siyuan'
import { buildTemplateFilterBlocksQuery, resolveTemplateFilterKeys } from '@/composables/attrStatsSql'
import { createAvDatabaseFromBlocks } from '@/composables/useAvDatabaseCreation'
import { useTemplates } from '@/composables/useTemplates'
import { getBlockInfo, sql } from '@/api'
import { shortBlockId } from '@/utils/dom'
import { highlightBlock, isDocOpened, scrollOpenedDocToBlock } from '@/utils/blockJump'
import AttrSection from './AttrSection.vue'

const props = defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const { templates } = useTemplates()

const activeFilterTplId = ref<string | null>(null)
const filterLoading = ref(false)
const searchScope = ref<'notebook' | 'doc'>('notebook')

interface FilteredBlock {
  id: string
  content: string
  hpath: string
  type: string
}

const filteredBlocks = ref<FilteredBlock[]>([])
const selectedBlockIds = ref<Set<string>>(new Set())
const creatingDb = ref(false)

// 当前定位到的 boxID 和 docBlockID
const currentBoxId = ref<string | null>(null)
const currentDocBlockId = ref<string | null>(null)

// 监听 props 变化，解析出笔记本 ID 和当前文档 ID
watch(
  () => props.rootId || props.blockId,
  async (seedId) => {
    if (!seedId) return
    try {
      const info = await getBlockInfo(seedId)
      if (info) {
        currentBoxId.value = info.box || null
        currentDocBlockId.value = info.rootID || null
      }
    } catch {
      // 忽略解析错误
    }
  },
  { immediate: true }
)


// 全选状态计算
const isAllSelected = computed(() => {
  if (filteredBlocks.value.length === 0) return false
  return filteredBlocks.value.every((b) => selectedBlockIds.value.has(b.id))
})

const isPartiallySelected = computed(() => {
  if (filteredBlocks.value.length === 0) return false
  const selectedCount = filteredBlocks.value.filter((b) => selectedBlockIds.value.has(b.id)).length
  return selectedCount > 0 && selectedCount < filteredBlocks.value.length
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    filteredBlocks.value.forEach((b) => selectedBlockIds.value.delete(b.id))
  } else {
    filteredBlocks.value.forEach((b) => selectedBlockIds.value.add(b.id))
  }
}

function toggleSelectBlock(id: string) {
  if (selectedBlockIds.value.has(id)) {
    selectedBlockIds.value.delete(id)
  } else {
    selectedBlockIds.value.add(id)
  }
}

// 属性排序函数（支持永久保存）
function moveAttr(tplId: string, index: number, direction: number) {
  const tpl = templates.value.find((t) => t.id === tplId)
  if (!tpl) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= tpl.attrs.length) return

  // 交换数组元素
  const temp = tpl.attrs[index]
  tpl.attrs[index] = tpl.attrs[targetIndex]
  tpl.attrs[targetIndex] = temp
}

// 触发筛选面板显示/隐藏
function toggleFilter(tpl: any) {
  if (activeFilterTplId.value === tpl.id) {
    activeFilterTplId.value = null
    filteredBlocks.value = []
    selectedBlockIds.value.clear()
  } else {
    activeFilterTplId.value = tpl.id
    runFilter(tpl)
  }
}

// 执行 SQL 筛选匹配的块
async function runFilter(tpl: any) {
  if (!tpl || tpl.attrs.length === 0) {
    filteredBlocks.value = []
    selectedBlockIds.value.clear()
    return
  }

  filterLoading.value = true
  filteredBlocks.value = []
  selectedBlockIds.value.clear()
  try {
    const keys = resolveTemplateFilterKeys(tpl.attrs)

    let scope: Parameters<typeof buildTemplateFilterBlocksQuery>[1]
    if (searchScope.value === 'doc') {
      if (!currentDocBlockId.value) {
        throw new Error(t('currentDocIdMissing'))
      }
      scope = { kind: 'doc', docId: currentDocBlockId.value }
    } else {
      if (!currentBoxId.value) {
        throw new Error(t('currentNotebookIdMissing'))
      }
      scope = { kind: 'notebook', boxId: currentBoxId.value }
    }

    const rawRows = await sql(buildTemplateFilterBlocksQuery(keys, scope))
    if (Array.isArray(rawRows)) {
      filteredBlocks.value = rawRows.map((row: any) => ({
        id: row.id,
        content: row.content,
        hpath: row.hpath,
        type: row.type || 'p',
      }))
      // 默认全选
      filteredBlocks.value.forEach((b) => selectedBlockIds.value.add(b.id))
    }
  } catch (err: any) {
    showMessage(err.message || t('filterFailed'), 5000, 'error')
  } finally {
    filterLoading.value = false
  }
}

// 块跳转逻辑
async function jumpToBlock(block: FilteredBlock) {
  const isOpened = isDocOpened(block.id)
  if (isOpened) {
    scrollOpenedDocToBlock(block.id)
    highlightBlock(block.id)
  } else {
    // 强制跳转
    await window.siyuan.blockPanels.showBlock({
      id: block.id,
    })
  }
}

// 创建思源原生属性视图数据库，含模板属性列，并回填已有属性值
async function createDatabaseFromSelection(tpl: any) {
  if (selectedBlockIds.value.size === 0) return
  creatingDb.value = true

  const selectedBlocks = filteredBlocks.value.filter(b => selectedBlockIds.value.has(b.id))

  try {
    const previousID = props.blockId || undefined
    const parentID = props.blockId ? undefined : (props.rootId || undefined)

    if (!previousID && !parentID) {
      throw new Error(t('insertContextMissing'))
    }

    await createAvDatabaseFromBlocks({
      templateName: tpl.name,
      templateAttrs: tpl.attrs ?? [],
      blocks: selectedBlocks,
      previousID,
      parentID,
      t,
    })

    // 重置并折叠筛选区
    activeFilterTplId.value = null
    filteredBlocks.value = []
    selectedBlockIds.value.clear()
  } catch (err: any) {
    console.error('[spm] create database failed:', err)
    showMessage(err.message || t('createDatabaseFailed'), 5000, 'error')
  } finally {
    creatingDb.value = false
  }
}
</script>
