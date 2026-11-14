<template>
  <AttrSection
    :title="t('notebookAttrStats')"
    :count="nbLoading || totalBlocks === 0 ? undefined : totalBlocks"
    storage-key="stats-nb"
    :default-open="true"
  >
    <div class="spm-stats__filter-bar">
      <div class="spm-stats__filter-input-wrap">
        <svg class="spm-icon spm-stats__filter-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input
          v-model="attrNameFilter"
          type="text"
          class="b3-text-field spm-stats__filter-input"
          :placeholder="t('filterAttrNamePlaceholder')"
          @keydown.escape="attrNameFilter = ''"
        >
        <button
          v-if="attrNameFilter"
          class="spm-stats__filter-clear"
          type="button"
          :title="t('clear')"
          @click="attrNameFilter = ''"
        >
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>

    <div v-if="nbLoading" class="spm-stats__empty">{{ t('loading') }}</div>
    <div v-else-if="nbError" class="spm-stats__empty spm-stats__empty--error">
      {{ t('statsLoadError') }}: {{ nbError }}
    </div>
    <div v-else-if="groups.length === 0" class="spm-stats__empty">{{ t('noNotebookStats') }}</div>
    <div v-else class="spm-stats__card-grid">
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

      <div class="spm-stats__batch-toggle-bar">
        <label class="spm-stats__toggle-label">
          <input type="checkbox" v-model="batchMode" class="spm-stats__toggle-checkbox">
          <span>{{ t('enableBatchEdit') }}</span>
        </label>
        <button
          class="spm-stats__prefix-rename-btn"
          type="button"
          :title="t('batchPrefixRenameTooltip')"
          @click="openBatchPrefixRenameDialog"
        >
          {{ t('batchPrefixRename') }}
        </button>
      </div>

      <div v-if="batchMode && selectedValues.size > 0" class="spm-stats__batch-bar">
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

      <div v-if="filteredGroups.length === 0" class="spm-stats__empty">
        {{ t('noMatchingAttrs') }}
      </div>

      <template v-else>
        <div v-for="group in filteredGroups" :key="group.name" class="spm-stats__card">
        <div class="spm-stats__card-header">
          <label v-if="batchMode" class="spm-stats__card-select-all">
            <input
              type="checkbox"
              :checked="isGroupAllSelected(group)"
              :indeterminate="isGroupPartial(group)"
              @change="toggleGroupSelect(group)"
            >
          </label>
          <span class="spm-stats__card-name">{{ group.name.slice(prefixLen) }}</span>
          <div class="spm-stats__card-header-right">
            <span class="spm-stats__card-count">
              {{ t('cardStatSummary').replace('{values}', String(group.values.length)).replace('{blocks}', String(getGroupBlockCount(group))) }}
            </span>
            <button
              class="spm-stats__action-btn spm-stats__card-rename-btn"
              type="button"
              :title="t('renameAttrKey')"
              @click.stop="openRenameAttrKeyDialog(group.name)"
            >
              <svg class="spm-icon" width="13" height="13" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          </div>
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
                v-if="batchMode"
                type="checkbox"
                class="spm-stats__value-checkbox"
                :checked="isSelected(group.name, val.value)"
                @change="toggleSelect(group.name, val.value)"
              >
              <button
                class="spm-stats__value-expand-toggle"
                type="button"
                :class="{ 'spm-stats__value-expand-toggle--rotated': expandedValueKeys.has(makeSelectionKey(group.name, val.value)) }"
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

            <BlockListDrilldown
              :visible="expandedValueKeys.has(makeSelectionKey(group.name, val.value))"
              :cache="valueBlocksCache[makeSelectionKey(group.name, val.value)]"
              @copy="copyText"
              @jump="jumpToSubBlock"
            />
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
      </template>
    </div>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, nextTick, reactive, ref, watch } from 'vue'
import { confirm, Dialog, showMessage } from 'siyuan'
import { getRuntimeSettings } from '@/settings'
import type { AttrStatGroup, DocBlockWithAttrs } from '@/composables/useSharedStats'
import type { BlockInfoByAttr } from '@/composables/useNotebookAttrStats'
import { batchDeleteAttr, batchEditAttr, batchRenameAttrKey, batchReplaceAttrKeyPrefix, getBlocksByAttrValue, normalizeCustomAttrKey, planBatchReplaceAttrKey, useNotebookAttrStats } from '@/composables/useNotebookAttrStats'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { attrStatsError } from '@/utils/logger'
import { getBlockInfo } from '@/api'
import AttrSection from './AttrSection.vue'
import BlockListDrilldown from './BlockListDrilldown.vue'
import { getGroupBlockCount, sortAttrGroups } from '@/utils/notebookStatsSort'
import { filterNotebookAttrGroups } from '@/utils/attrStatsFilter'
import { makeSelectionKey, parseSelectionKey } from '@/utils/selectionKey'
import { copyTextToClipboard } from '@/utils/clipboard'

const props = defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const emit = defineEmits<{
  (e: 'jump-to-block', block: DocBlockWithAttrs): void
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

const prefixLen = CUSTOM_KEY_PREFIX.length
const defaultVisible = 5

const batchMode = ref(false)
watch(batchMode, (newVal) => {
  if (!newVal) {
    selectedValues.clear()
  }
})

const rootIdRef = computed(() => props.rootId)
const blockIdRef = computed(() => props.blockId)

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

const selectedValues = reactive(new Set<string>())

function isSelected(name: string, value: string): boolean {
  return selectedValues.has(makeSelectionKey(name, value))
}

function toggleSelect(name: string, value: string) {
  const key = makeSelectionKey(name, value)
  if (selectedValues.has(key))
    selectedValues.delete(key)
  else
    selectedValues.add(key)
}

function isGroupAllSelected(group: AttrStatGroup): boolean {
  return group.values.length > 0 && group.values.every(v => selectedValues.has(makeSelectionKey(group.name, v.value)))
}

function isGroupPartial(group: AttrStatGroup): boolean {
  const selected = group.values.filter(v => selectedValues.has(makeSelectionKey(group.name, v.value))).length
  return selected > 0 && selected < group.values.length
}

function toggleGroupSelect(group: AttrStatGroup) {
  if (isGroupAllSelected(group)) {
    for (const v of group.values)
      selectedValues.delete(makeSelectionKey(group.name, v.value))
  }
  else {
    for (const v of group.values)
      selectedValues.add(makeSelectionKey(group.name, v.value))
  }
}

function selectNone() {
  selectedValues.clear()
}

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

async function deleteSingleValue(name: string, value: string, count: number) {
  const msg = t('confirmDelete').replace('{count}', String(count))
  confirm('siyuan-property-manager', msg, async () => {
    const bid = await resolveBoxId()
    if (!bid) return
    const deleted = await batchDeleteAttr(bid, name, value)
    if (deleted > 0) {
      selectedValues.delete(makeSelectionKey(name, value))
      reloadStats()
    }
  })
}

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

    setTimeout(() => {
      const input = getInput()
      input?.focus()

      dialog.element.querySelector('[data-action="ok"]')?.addEventListener('click', () => {
        doResolve(getInput()?.value?.trim() || null)
      })
      dialog.element.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        doResolve(null)
      })
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
    const parsed = parseSelectionKey(key)
    if (!parsed)
      continue
    try {
      total += await batchEditAttr(bid, parsed.name, parsed.value, newValue)
    }
    catch (err: any) {
      attrStatsError('batchEdit per-value failed', { name: parsed.name, oldValue: parsed.value, newValue, error: err?.message ?? String(err) })
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
      const parsed = parseSelectionKey(key)
      if (!parsed)
        continue
      try {
        total += await batchDeleteAttr(bid, parsed.name, parsed.value)
      }
      catch (err: any) {
        attrStatsError('batchDelete per-value failed', { name: parsed.name, value: parsed.value, error: err?.message ?? String(err) })
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

const attrNameFilter = ref('')

const sortedGroups = computed(() => {
  return sortAttrGroups(groups.value, sortBy.value, sortOrder.value)
})

const filteredGroups = computed(() => {
  return filterNotebookAttrGroups(sortedGroups.value, attrNameFilter.value)
})

const expandedValueKeys = ref(new Set<string>())
const valueBlocksCache = ref<Record<string, BlockInfoByAttr[] | 'loading'>>({})

async function toggleValueExpand(groupName: string, val: string) {
  const key = makeSelectionKey(groupName, val)
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

function copyText(text: string) {
  void copyTextToClipboard(text)
}

function jumpToSubBlock(blk: BlockInfoByAttr) {
  emit('jump-to-block', {
    id: blk.id,
    rootId: blk.root_id,
    content: blk.content,
    type: blk.type,
    attrs: [],
  })
}

function openRenameAttrKeyDialog(oldAttrName: string) {
  const shortOldName = oldAttrName.startsWith(CUSTOM_KEY_PREFIX) ? oldAttrName.slice(prefixLen) : oldAttrName
  const html = `<div class="spm-dialog">
    <div class="spm-dialog__label">${t('newAttrKeyPlaceholder')}</div>
    <input class="spm-dialog__input b3-text-field" id="spm-rename-key-input" type="text" value="${shortOldName}">
    <div class="spm-dialog__actions">
      <button class="b3-button b3-button--cancel" data-action="cancel">${t('cancel')}</button>
      <button class="b3-button b3-button--text" data-action="ok">${t('ok')}</button>
    </div>
  </div>`
  const dialog = new Dialog({
    title: t('renameAttrKey'),
    content: html,
    width: '390px',
  })

  const getInput = () => dialog.element.querySelector('#spm-rename-key-input') as HTMLInputElement | null

  const submit = async () => {
    const rawNewKey = getInput()?.value?.trim() || ''
    const normalizedNew = normalizeCustomAttrKey(rawNewKey)
    if (!normalizedNew) {
      showMessage(t('invalidKeyHint'), 3000, 'error')
      return
    }
    if (normalizedNew === oldAttrName) {
      dialog.destroy()
      return
    }
    dialog.destroy()
    const bid = await resolveBoxId()
    if (!bid) return
    const updatedCount = await batchRenameAttrKey(bid, oldAttrName, normalizedNew)
    if (updatedCount > 0) {
      showMessage(
        t('renameAttrKeySuccess')
          .replace('{oldKey}', shortOldName)
          .replace('{newKey}', normalizedNew.slice(prefixLen))
          .replace('{count}', String(updatedCount)),
        3000,
        'info',
      )
      reloadStats()
    }
  }

  setTimeout(() => {
    const input = getInput()
    input?.focus()
    input?.select()
    dialog.element.querySelector('[data-action="ok"]')?.addEventListener('click', () => {
      void submit()
    })
    dialog.element.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      dialog.destroy()
    })
    input?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        void submit()
      }
    })
  }, 50)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function openBatchPrefixRenameDialog() {
  const html = `<div class="spm-dialog">
    <div class="spm-dialog__label">${t('oldPrefixLabel')}</div>
    <input class="spm-dialog__input b3-text-field" id="spm-old-prefix-input" type="text" placeholder="slide" value="">
    <div class="spm-dialog__label">${t('newPrefixLabel')}</div>
    <input class="spm-dialog__input b3-text-field" id="spm-new-prefix-input" type="text" placeholder="slides" value="">
    <div class="spm-dialog__actions">
      <button class="b3-button b3-button--cancel" data-action="cancel">${t('cancel')}</button>
      <button class="b3-button b3-button--text" data-action="ok">${t('ok')}</button>
    </div>
  </div>`
  const dialog = new Dialog({
    title: t('batchPrefixRenameTitle'),
    content: html,
    width: '410px',
  })

  const getOldInput = () => dialog.element.querySelector('#spm-old-prefix-input') as HTMLInputElement | null
  const getNewInput = () => dialog.element.querySelector('#spm-new-prefix-input') as HTMLInputElement | null

  const submit = async () => {
    const oldText = getOldInput()?.value?.trim() || ''
    const newText = getNewInput()?.value?.trim() || ''
    if (!oldText || !newText || oldText === newText) {
      dialog.destroy()
      return
    }

    const plan = planBatchReplaceAttrKey(groups.value, oldText, newText)
    if (!plan.valid || plan.items.length === 0) {
      showMessage(t('noMatchingPrefixAttrs'), 3000, 'info')
      return
    }

    if (plan.invalidKeys.length > 0) {
      showMessage(t('batchRenameInvalidNewKey').replace('{key}', plan.invalidKeys[0]), 3500, 'error')
      return
    }

    dialog.destroy()

    const maxItemsToShow = 25
    const displayedItems = plan.items.slice(0, maxItemsToShow)
    const itemsHtml = displayedItems.map((item, idx) => {
      const isLast = idx === displayedItems.length - 1 && plan.items.length <= maxItemsToShow
      const borderStyle = isLast ? '' : 'border-bottom: 1px dashed var(--b3-theme-surface-lighter);'
      const blockText = t('batchRenameConfirmBlockCount').replace('{count}', String(item.blockCount))
      return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; ${borderStyle}">
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px;">
          <span style="color: var(--b3-theme-on-surface); font-weight: 500;">${escapeHtml(item.shortOld)}</span>
          <span style="color: var(--b3-theme-primary); font-weight: bold; margin: 0 6px;">➜</span>
          <span style="color: var(--b3-theme-on-surface); font-weight: 500;">${escapeHtml(item.shortNew)}</span>
        </span>
        <span style="color: var(--b3-theme-on-surface-light); font-size: 11px; flex-shrink: 0;">${escapeHtml(blockText)}</span>
      </div>`
    }).join('')

    const moreHtml = plan.items.length > maxItemsToShow
      ? `<div style="color: var(--b3-theme-on-surface-light); font-size: 11px; padding-top: 6px; text-align: center;">${escapeHtml(t('batchRenameConfirmMore').replace('{attrs}', String(plan.items.length)))}</div>`
      : ''

    const totalBlocks = plan.items.reduce((s, i) => s + i.blockCount, 0)
    const summaryText = t('batchRenameConfirmSummary')
      .replace('{attrs}', String(plan.items.length))
      .replace('{blocks}', String(totalBlocks))

    const confirmHtml = `<div style="font-size: 13px; line-height: 1.6;">
      <div style="margin-bottom: 8px;">${summaryText}</div>
      <div style="max-height: 220px; overflow-y: auto; background: var(--b3-theme-background); padding: 8px 12px; border-radius: 4px; font-family: var(--b3-font-family-code); font-size: 12px; line-height: 1.6; margin: 8px 0; border: 1px solid var(--b3-theme-surface-lighter);">
        ${itemsHtml}
        ${moreHtml}
      </div>
      <div style="margin-top: 8px; font-weight: 500;">${t('batchRenameConfirmQuestion')}</div>
    </div>`

    confirm(
      t('batchRenameConfirmTitle'),
      confirmHtml,
      async () => {
        const bid = await resolveBoxId()
        if (!bid) return
        let renamedAttrs = 0
        let updatedBlocks = 0
        for (const item of plan.items) {
          const count = await batchRenameAttrKey(bid, item.oldKey, item.newKey)
          if (count > 0) {
            renamedAttrs++
            updatedBlocks += count
          }
        }
        if (renamedAttrs > 0) {
          showMessage(
            t('batchPrefixRenameSuccess')
              .replace('{attrs}', String(renamedAttrs))
              .replace('{blocks}', String(updatedBlocks)),
            3500,
            'info',
          )
          reloadStats()
        }
      },
    )
  }

  setTimeout(() => {
    const header = dialog.element.querySelector('.b3-dialog__header')
    if (header && !header.querySelector('.spm-dialog-title-info')) {
      const infoSpan = document.createElement('span')
      infoSpan.className = 'spm-dialog-title-info'
      infoSpan.title = t('batchPrefixRenameTooltip')
      infoSpan.style.cssText = 'margin-left: 6px; cursor: help; display: inline-flex; vertical-align: middle; opacity: 0.75;'
      infoSpan.innerHTML = `<svg class="spm-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
      header.appendChild(infoSpan)
    }

    const oldInput = getOldInput()
    const newInput = getNewInput()
    oldInput?.focus()
    oldInput?.select()

    dialog.element.querySelector('[data-action="ok"]')?.addEventListener('click', () => {
      void submit()
    })
    dialog.element.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      dialog.destroy()
    })
    oldInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        newInput?.focus()
        newInput?.select()
      }
    })
    newInput?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        void submit()
      }
    })
  }, 50)
}
</script>
