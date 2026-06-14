<template>
  <div class="spm-stats">
    <!-- 文档自定义属性块 -->
    <AttrSection
      :title="t('docCustomBlocks')"
      :count="docLoading ? undefined : docBlocks.length"
      storage-key="stats-doc"
      :default-open="true"
    >
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
            <button
              class="spm-stats__jump-edit-btn"
              type="button"
              :title="t('jumpAndEdit')"
              @click.stop="jumpAndEdit(block)"
            >
              <svg class="spm-icon" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
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
    </AttrSection>

    <!-- 笔记本自定义属性统计 -->
    <AttrSection
      :title="t('notebookAttrStats')"
      :count="nbLoading || totalBlocks === 0 ? undefined : totalBlocks"
      storage-key="stats-nb"
      :default-open="true"
    >
      <div v-if="nbLoading" class="spm-stats__empty">{{ t('loading') }}</div>
      <div v-else-if="nbError" class="spm-stats__empty spm-stats__empty--error">
        {{ t('statsLoadError') }}: {{ nbError }}
      </div>
      <div v-else-if="groups.length === 0" class="spm-stats__empty">{{ t('noNotebookStats') }}</div>
      <div v-else class="spm-stats__card-grid">
        <!-- 排序选项栏 -->
        <div class="spm-stats__sort-bar">
          <span class="spm-stats__sort-label">{{ t('sortBy') }}</span>
          <select v-model="sortBy" class="spm-stats__select">
            <option value="name">{{ t('sortByName') }}</option>
            <option value="values">{{ t('sortByValuesCount') }}</option>
            <option value="blocks">{{ t('sortByBlocksCount') }}</option>
          </select>
          <select v-model="sortOrder" class="spm-stats__select">
            <option value="asc">{{ t('sortAscending') }}</option>
            <option value="desc">{{ t('sortDescending') }}</option>
          </select>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="selectedValues.size > 0" class="spm-stats__batch-bar">
          <span class="spm-stats__batch-count">{{ t('selectedCount').replace('{count}', String(selectedValues.size)) }}</span>
          <button class="spm-stats__batch-btn spm-stats__batch-btn--edit" @click="batchEdit">
            {{ t('batchEdit') }}
          </button>
          <button class="spm-stats__batch-btn spm-stats__batch-btn--delete" @click="batchDelete">
            {{ t('batchDelete') }}
          </button>
          <button class="spm-stats__batch-btn spm-stats__batch-btn--clear" @click="selectNone">
            {{ t('selectNone') }}
          </button>
        </div>

        <div v-for="group in sortedGroups" :key="group.name" class="spm-stats__card">
          <div class="spm-stats__card-header">
            <label class="spm-stats__card-select-all">
              <input
                type="checkbox"
                :checked="isGroupAllSelected(group)"
                :indeterminate="isGroupPartial(group)"
                @change="toggleGroupSelect(group)"
              >
            </label>
            <span class="spm-stats__card-name">{{ group.name.slice(prefixLen) }}</span>
            <span class="spm-stats__card-count">
              {{ t('cardStatSummary').replace('{values}', String(group.values.length)).replace('{blocks}', String(getGroupBlockCount(group))) }}
            </span>
          </div>
          <div class="spm-stats__card-values">
            <div
              v-for="val in visibleValues(group)"
              :key="val.value"
              class="spm-stats__value-group"
            >
              <div
                class="spm-stats__value-row"
                :class="{ 'spm-stats__value-row--selected': isSelected(group.name, val.value) }"
              >
                <input
                  type="checkbox"
                  class="spm-stats__value-checkbox"
                  :checked="isSelected(group.name, val.value)"
                  @change="toggleSelect(group.name, val.value)"
                >
                <button
                  class="spm-stats__value-expand-toggle"
                  type="button"
                  :class="{ 'spm-stats__value-expand-toggle--rotated': expandedValueKeys.has(makeKey(group.name, val.value)) }"
                  @click.stop="toggleValueExpand(group.name, val.value)"
                >
                  <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
                <template v-if="isEditing(group.name, val.value)">
                  <input
                    ref="editInputRefs"
                    v-model="editInput"
                    class="spm-stats__edit-input"
                    :placeholder="t('newValuePlaceholder')"
                    @keydown.enter="confirmEdit"
                    @keydown.escape="cancelEdit"
                    @blur="cancelEdit"
                  >
                </template>
                <template v-else>
                  <span class="spm-stats__value-text" :title="val.value" @click.stop="toggleValueExpand(group.name, val.value)">
                    {{ val.value || '·' }}
                  </span>
                  <span class="spm-stats__value-count">{{ val.count }}</span>
                  <div class="spm-stats__value-actions">
                    <button
                      class="spm-stats__action-btn"
                      :title="t('editValue')"
                      @click.stop="startEdit(group.name, val.value)"
                    >
                      <svg class="spm-icon" width="14" height="14" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button
                      class="spm-stats__action-btn spm-stats__action-btn--delete"
                      :title="t('deleteValue')"
                      @click.stop="deleteSingleValue(group.name, val.value, val.count)"
                    >
                      <svg class="spm-icon" width="14" height="14" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </template>
              </div>

              <!-- 展开的块详情列表 -->
              <div
                v-if="expandedValueKeys.has(makeKey(group.name, val.value))"
                class="spm-stats__value-blocks"
              >
                <div
                  v-if="valueBlocksCache[makeKey(group.name, val.value)] === 'loading'"
                  class="spm-stats__blocks-loading"
                >
                  {{ t('loading') }}
                </div>
                <div
                  v-else-if="Array.isArray(valueBlocksCache[makeKey(group.name, val.value)])"
                  class="spm-stats__blocks-list"
                >
                  <div
                    v-for="blk in valueBlocksCache[makeKey(group.name, val.value)]"
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
                        {{ blk.content ? (blk.content.slice(0, 5) + (blk.content.length > 5 ? '...' : '')) : t('emptyValue') }}
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
                    v-if="(valueBlocksCache[makeKey(group.name, val.value)] as any[]).length === 0"
                    class="spm-stats__blocks-empty"
                  >
                    {{ t('noCustomBlocks') }}
                  </div>
                </div>
              </div>
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
    </AttrSection>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, nextTick, reactive, ref, watch } from 'vue'
import { confirm, Dialog, openTab, showMessage } from 'siyuan'
import { getRuntimeSettings } from '@/settings'
import type { AttrStatGroup, BlockInfoByAttr, DocBlockWithAttrs } from '@/composables/useAttrStats'
import { batchDeleteAttr, batchEditAttr, getBlocksByAttrValue, useDocCustomBlocks, useNotebookAttrStats } from '@/composables/useAttrStats'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { attrStatsError } from '@/utils/logger'
import { highlightBlock, isDocOpened, scrollOpenedDocToBlock, scrollOpenedDocToTop, shouldFallbackToDocTop } from '@/utils/blockJump'
import { shortBlockId } from '@/utils/dom'
import { getBlockInfo } from '@/api'
import AttrSection from './AttrSection.vue'
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

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const prefixLen = CUSTOM_KEY_PREFIX.length
const defaultVisible = 5

const rootIdRef = computed(() => props.rootId)
const blockIdRef = computed(() => props.blockId)

const { blocks: docBlocks, loading: docLoading } = useDocCustomBlocks(rootIdRef, blockIdRef)
const { groups, totalBlocks, loading: nbLoading, error: nbError, reload: reloadStats } = useNotebookAttrStats(rootIdRef, blockIdRef)

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

// --- boxId 解析 ---
const boxId = ref<string | null>(null)

async function resolveBoxId(): Promise<string | null> {
  if (boxId.value) return boxId.value
  const rid = props.rootId ?? props.blockId
  if (!rid) return null
  try {
    const info = await getBlockInfo(rid)
    boxId.value = info?.box ?? null
  }
  catch {
    boxId.value = null
  }
  return boxId.value
}

// --- 选择状态 ---
const selectedValues = reactive(new Set<string>())

function makeKey(name: string, value: string): string {
  return `${name} ${value}`
}

function isSelected(name: string, value: string): boolean {
  return selectedValues.has(makeKey(name, value))
}

function toggleSelect(name: string, value: string) {
  const key = makeKey(name, value)
  if (selectedValues.has(key))
    selectedValues.delete(key)
  else
    selectedValues.add(key)
}

function isGroupAllSelected(group: AttrStatGroup): boolean {
  return group.values.length > 0 && group.values.every(v => selectedValues.has(makeKey(group.name, v.value)))
}

function isGroupPartial(group: AttrStatGroup): boolean {
  const selected = group.values.filter(v => selectedValues.has(makeKey(group.name, v.value))).length
  return selected > 0 && selected < group.values.length
}

function toggleGroupSelect(group: AttrStatGroup) {
  if (isGroupAllSelected(group)) {
    for (const v of group.values)
      selectedValues.delete(makeKey(group.name, v.value))
  }
  else {
    for (const v of group.values)
      selectedValues.add(makeKey(group.name, v.value))
  }
}

function selectNone() {
  selectedValues.clear()
}

// --- 单值编辑 ---
const editingValue = ref<{ name: string, oldValue: string } | null>(null)
const editInput = ref('')
const editInputRefs = ref<HTMLInputElement[]>([])

function isEditing(name: string, value: string): boolean {
  return editingValue.value?.name === name && editingValue.value?.oldValue === value
}

function startEdit(name: string, oldValue: string) {
  editingValue.value = { name, oldValue }
  editInput.value = oldValue
  nextTick(() => {
    editInputRefs.value[0]?.focus()
  })
}

function cancelEdit() {
  editingValue.value = null
  editInput.value = ''
}

async function confirmEdit() {
  const ev = editingValue.value
  if (!ev) return
  const bid = await resolveBoxId()
  if (!bid) return
  const count = await batchEditAttr(bid, ev.name, ev.oldValue, editInput.value)
  cancelEdit()
  if (count > 0) {
    reloadStats()
  }
}

// --- 单值删除 ---
async function deleteSingleValue(name: string, value: string, count: number) {
  const msg = t('confirmDelete').replace('{count}', String(count))
  confirm('siyuan-property-manager', msg, async () => {
    const bid = await resolveBoxId()
    if (!bid) return
    const deleted = await batchDeleteAttr(bid, name, value)
    if (deleted > 0) {
      selectedValues.delete(makeKey(name, value))
      reloadStats()
    }
  })
}

// --- 批量操作 ---

/** 弹出 Dialog 让用户输入新值，替代不支持的 prompt() */
function promptForNewValue(): Promise<string | null> {
  return new Promise((resolve) => {
    const html = `<div class="spm-dialog">
      <div class="spm-dialog__label">${t('newValuePlaceholder')}</div>
      <input class="spm-dialog__input b3-text-field" id="spm-batch-edit-input" type="text">
      <div class="spm-dialog__actions">
        <button class="b3-button b3-button--cancel" data-action="cancel">${t('cancel')}</button>
        <button class="b3-button b3-button--text" data-action="ok">${t('ok')}</button>
      </div>
    </div>`
    let resolved = false
    const dialog = new Dialog({
      title: t('batchEditTitle'),
      content: html,
      width: '390px',
      destroyCallback: () => {
        if (!resolved) {
          resolved = true
          resolve(null)
        }
      },
    })

    const getInput = () => dialog.element.querySelector('#spm-batch-edit-input') as HTMLInputElement | null

    const doResolve = (val: string | null) => {
      if (resolved) return
      resolved = true
      dialog.destroy()
      resolve(val)
    }

    // 等 DOM 到位后绑定事件
    setTimeout(() => {
      const input = getInput()
      input?.focus()

      // 确定按钮
      dialog.element.querySelector('[data-action="ok"]')?.addEventListener('click', () => {
        doResolve(getInput()?.value?.trim() || null)
      })
      // 取消按钮
      dialog.element.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        doResolve(null)
      })
      // Enter 提交
      input?.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          doResolve(input?.value?.trim() || null)
        }
      })
    }, 50)
  })
}

async function batchEdit() {
  const newValue = await promptForNewValue()
  if (!newValue) return
  const bid = await resolveBoxId()
  if (!bid) return
  let total = 0
  for (const key of [...selectedValues]) {
    const sep = key.indexOf('\x00')
    const name = key.slice(0, sep)
    const oldValue = key.slice(sep + 1)
    try {
      total += await batchEditAttr(bid, name, oldValue, newValue)
    }
    catch (err: any) {
      attrStatsError('batchEdit per-value failed', { name, oldValue, newValue, error: err?.message ?? String(err) })
    }
  }
  selectedValues.clear()
  if (total > 0) {
    reloadStats()
  }
}

async function batchDelete() {
  const totalSelected = selectedValues.size
  const msg = t('confirmDelete').replace('{count}', String(totalSelected))
  confirm('siyuan-property-manager', msg, async () => {
    const bid = await resolveBoxId()
    if (!bid) return
    let total = 0
    for (const key of [...selectedValues]) {
      const sep = key.indexOf('\x00')
      const name = key.slice(0, sep)
      const value = key.slice(sep + 1)
      try {
        total += await batchDeleteAttr(bid, name, value)
      }
      catch (err: any) {
        attrStatsError('batchDelete per-value failed', { name, value, error: err?.message ?? String(err) })
      }
    }
    selectedValues.clear()
    if (total > 0) {
      reloadStats()
    }
  })
}

const initialSettings = getRuntimeSettings()
const sortBy = ref<'name' | 'values' | 'blocks'>(initialSettings.attrStatsSortBy)
const sortOrder = ref<'asc' | 'desc'>(initialSettings.attrStatsSortOrder)

watch([sortBy, sortOrder], ([newSortBy, newSortOrder]) => {
  void (plugin as any).saveSettings({
    attrStatsSortBy: newSortBy,
    attrStatsSortOrder: newSortOrder,
  })
})


function getGroupBlockCount(group: AttrStatGroup): number {
  return group.values.reduce((sum, val) => sum + val.count, 0)
}

const sortedGroups = computed(() => {
  const list = [...groups.value]
  const orderMultiplier = sortOrder.value === 'asc' ? 1 : -1

  list.sort((a, b) => {
    if (sortBy.value === 'name') {
      const nameA = a.name.toLowerCase()
      const nameB = b.name.toLowerCase()
      return nameA.localeCompare(nameB) * orderMultiplier
    }
    else if (sortBy.value === 'values') {
      return (a.values.length - b.values.length) * orderMultiplier
    }
    else if (sortBy.value === 'blocks') {
      const countA = getGroupBlockCount(a)
      const countB = getGroupBlockCount(b)
      return (countA - countB) * orderMultiplier
    }
    return 0
  })

  return list
})

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
    doc: { id: targetId, action: ['cb-get-focus'] },
  })
}

function jumpAndEdit(block: DocBlockWithAttrs) {
  jumpToBlock(block)
  emit('jump-to-edit')
}

// --- 属性值展开详情支持 ---
const expandedValueKeys = ref(new Set<string>())
const valueBlocksCache = ref<Record<string, BlockInfoByAttr[] | 'loading'>>({})

async function toggleValueExpand(groupName: string, val: string) {
  const key = makeKey(groupName, val)
  if (expandedValueKeys.value.has(key)) {
    expandedValueKeys.value.delete(key)
  }
  else {
    expandedValueKeys.value.add(key)
    if (!valueBlocksCache.value[key]) {
      valueBlocksCache.value[key] = 'loading'
      const bid = await resolveBoxId()
      if (bid) {
        const data = await getBlocksByAttrValue(bid, groupName, val)
        valueBlocksCache.value[key] = data
      }
      else {
        valueBlocksCache.value[key] = []
      }
    }
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    showMessage(t('copied'), 2000)
  }
  catch {
    // 忽略
  }
}

function jumpToSubBlock(blk: BlockInfoByAttr) {
  jumpToBlock({
    id: blk.id,
    rootId: blk.root_id,
    content: blk.content,
    type: blk.type,
    attrs: [],
  })
}
</script>
