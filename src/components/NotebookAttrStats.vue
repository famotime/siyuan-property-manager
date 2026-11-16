<template>
  <AttrSection
    :title="t('notebookAttrStats')"
    :tooltip="t('notebookAttrStatsTooltip')"
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
      <button
        class="spm-stats__filter-ignore-btn"
        :class="{ 'spm-stats__filter-ignore-btn--active': isIgnoreActive }"
        type="button"
        :title="ignoreBtnTooltip"
        @click="openIgnoreAttrDialog"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
        <span v-if="isIgnoreActive && ignoredCount > 0" class="spm-stats__filter-ignore-badge">
          {{ ignoredCount }}
        </span>
      </button>
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
        <button
          class="spm-stats__refactor-btn b3-button b3-button--outline"
          type="button"
          :title="t('batchRefactorTooltip')"
          @click="openGlobalBatchRefactor"
        >
          <svg class="spm-icon" width="13" height="13" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>{{ t('batchRefactor') }}</span>
        </button>
      </div>

      <div v-if="filteredGroups.length === 0" class="spm-stats__empty">
        {{ t('noMatchingAttrs') }}
      </div>

      <template v-else>
        <div v-for="group in filteredGroups" :key="group.name" class="spm-stats__card">
        <div class="spm-stats__card-header">
          <template v-if="isEditingKey(group.name)">
            <input
              ref="editKeyInputRef"
              v-model="editKeyInput"
              class="b3-text-field spm-stats__card-name-input"
              :placeholder="t('newAttrKeyPlaceholder')"
              @keydown.enter="confirmEditKey"
              @keydown.escape.prevent="cancelEditKey"
              @blur="confirmEditKey"
              @click.stop
            >
          </template>
          <template v-else>
            <span class="spm-stats__card-name" @click.stop="startEditKey(group.name)">{{ group.name.slice(prefixLen) }}</span>
            <div class="spm-stats__card-header-right">
              <span class="spm-stats__card-count">
                {{ t('cardStatSummary').replace('{values}', String(group.values.length)).replace('{blocks}', String(getGroupBlockCount(group))) }}
              </span>
              <button
                class="spm-stats__action-btn spm-stats__card-rename-btn"
                type="button"
                :title="t('renameAttrKey')"
                @click.stop="startEditKey(group.name)"
              >
                <svg class="spm-icon" width="13" height="13" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            </div>
          </template>
        </div>
        <div class="spm-stats__card-values">
          <div
            v-for="val in visibleValues(group)"
            :key="val.value"
            class="spm-stats__value-group"
          >
            <div class="spm-stats__value-row">
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
                  @keydown.escape.prevent="cancelEdit"
                  @blur="confirmEdit"
                  @click.stop
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
import { computed, inject, nextTick, ref, watch } from 'vue'
import { confirm, Dialog, showMessage } from 'siyuan'
import { getRuntimeSettings } from '@/settings'
import type { AttrStatGroup, DocBlockWithAttrs } from '@/composables/useSharedStats'
import type { BlockInfoByAttr } from '@/composables/useNotebookAttrStats'
import {
  batchDeleteAttr,
  batchEditAttr,
  batchRenameAttrKey,
  getBlocksByAttrValue,
  normalizeCustomAttrKey,
  useNotebookAttrStats,
} from '@/composables/useNotebookAttrStats'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { getBlockInfo } from '@/api'
import AttrSection from './AttrSection.vue'
import BlockListDrilldown from './BlockListDrilldown.vue'
import { getGroupBlockCount, sortAttrGroups } from '@/utils/notebookStatsSort'
import {
  compileRegexPatterns,
  filterNotebookAttrGroups,
  getIgnoredAttrGroups,
  isAttrNameIgnored,
} from '@/utils/attrStatsFilter'
import { makeSelectionKey, parseSelectionKey } from '@/utils/selectionKey'
import { copyTextToClipboard } from '@/utils/clipboard'
import { openBatchRefactorDialog } from '@/main'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { useTemplates } from '@/composables/useTemplates'
import { useAvSync } from '@/composables/useAvSync'

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

// ---- 单个属性值编辑 (Inline Edit) ----
const editingValue = ref<{ name: string, oldValue: string } | null>(null)
const editInput = ref('')
const editInputRefs = ref<HTMLInputElement[]>([])
let isConfirmingValue = false

function isEditing(name: string, value: string): boolean {
  return editingValue.value?.name === name && editingValue.value?.oldValue === value
}

function startEdit(name: string, oldValue: string) {
  cancelEditKey()
  editingValue.value = { name, oldValue }
  editInput.value = oldValue
  nextTick(() => {
    editInputRefs.value[0]?.focus()
    editInputRefs.value[0]?.select()
  })
}

function cancelEdit() {
  editingValue.value = null
  editInput.value = ''
}

async function confirmEdit() {
  if (isConfirmingValue) return
  const ev = editingValue.value
  if (!ev) return
  if (ev.oldValue === editInput.value) {
    cancelEdit()
    return
  }
  isConfirmingValue = true
  const bid = await resolveBoxId()
  const name = ev.name
  const oldValue = ev.oldValue
  const newValue = editInput.value
  cancelEdit()
  try {
    if (!bid) return
    const count = await batchEditAttr(bid, name, oldValue, newValue)
    if (count > 0) {
      reloadStats()
    }
  }
  finally {
    isConfirmingValue = false
  }
}

// ---- 单个属性名原位置编辑 (In-Place Edit) ----
const { renameSchema } = useAttrSchema()
const { renameAttrKeyInTemplates } = useTemplates()
const { renameAttrKeyInAvSync } = useAvSync()

const editingKey = ref<{ oldKey: string } | null>(null)
const editKeyInput = ref('')
const editKeyInputRef = ref<HTMLInputElement | null>(null)
let isConfirmingKey = false

function isEditingKey(name: string): boolean {
  return editingKey.value?.oldKey === name
}

function startEditKey(oldKey: string) {
  cancelEdit()
  editingKey.value = { oldKey }
  const shortOldName = oldKey.startsWith(CUSTOM_KEY_PREFIX) ? oldKey.slice(prefixLen) : oldKey
  editKeyInput.value = shortOldName
  nextTick(() => {
    editKeyInputRef.value?.focus()
    editKeyInputRef.value?.select()
  })
}

function cancelEditKey() {
  editingKey.value = null
  editKeyInput.value = ''
}

async function confirmEditKey() {
  if (isConfirmingKey) return
  const ek = editingKey.value
  if (!ek) return
  const oldKey = ek.oldKey
  const shortOldName = oldKey.startsWith(CUSTOM_KEY_PREFIX) ? oldKey.slice(prefixLen) : oldKey
  const rawNewKey = editKeyInput.value.trim()
  const normalizedNew = normalizeCustomAttrKey(rawNewKey)

  if (!normalizedNew) {
    showMessage(t('invalidKeyHint'), 3000, 'error')
    cancelEditKey()
    return
  }

  if (normalizedNew === oldKey) {
    cancelEditKey()
    return
  }

  isConfirmingKey = true
  cancelEditKey()
  try {
    const bid = await resolveBoxId()
    if (!bid) return

    const updatedCount = await batchRenameAttrKey(bid, oldKey, normalizedNew)
    if (updatedCount > 0) {
      renameSchema(oldKey, normalizedNew)
      renameAttrKeyInTemplates(oldKey, normalizedNew)
      renameAttrKeyInAvSync(oldKey, normalizedNew)
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
  finally {
    isConfirmingKey = false
  }
}

// ---- 全局批量重构 (Top Button) ----
async function openGlobalBatchRefactor() {
  const bid = await resolveBoxId()
  if (!bid) return
  openBatchRefactorDialog(
    {
      boxId: bid,
      groups: groups.value,
      initialScope: 'key',
      ignoreRegexes: isIgnoreActive.value ? compiledIgnoreRegexes.value : [],
      onSuccess: () => {
        reloadStats()
      },
    },
    plugin,
  )
}

async function deleteSingleValue(name: string, value: string, count: number) {
  const msg = t('confirmDelete').replace('{count}', String(count))
  confirm('siyuan-property-manager', msg, async () => {
    const bid = await resolveBoxId()
    if (!bid) return
    const deleted = await batchDeleteAttr(bid, name, value)
    if (deleted > 0) {
      reloadStats()
    }
  })
}

const initialSettings = getRuntimeSettings()
const sortBy = ref<'name' | 'values' | 'blocks'>(initialSettings.attrStatsSortBy)
const sortOrder = ref<'asc' | 'desc'>(initialSettings.attrStatsSortOrder)
const ignorePatterns = ref<string[]>([...initialSettings.notebookAttrIgnorePatterns])
const ignoreEnabled = ref<boolean>(initialSettings.notebookAttrIgnoreEnabled)

watch([sortBy, sortOrder], ([newSortBy, newSortOrder]) => {
  void (plugin as any).saveSettings({
    attrStatsSortBy: newSortBy,
    attrStatsSortOrder: newSortOrder,
  })
})

const compiledIgnoreRegexes = computed(() => {
  if (!ignoreEnabled.value || ignorePatterns.value.length === 0)
    return []
  return compileRegexPatterns(ignorePatterns.value)
})

const isIgnoreActive = computed(() => {
  return ignoreEnabled.value && compiledIgnoreRegexes.value.length > 0
})

const ignoredGroups = computed(() => {
  if (!isIgnoreActive.value)
    return []
  return getIgnoredAttrGroups(sortedGroups.value, compiledIgnoreRegexes.value)
})

const ignoredCount = computed(() => ignoredGroups.value.length)

const ignoreBtnTooltip = computed(() => {
  if (isIgnoreActive.value && ignoredCount.value > 0) {
    return t('ignoreAttrCountBadgeTooltip').replace('{count}', String(ignoredCount.value))
  }
  return t('ignoreAttrBtnTooltip')
})

const attrNameFilter = ref('')

const sortedGroups = computed(() => {
  return sortAttrGroups(groups.value, sortBy.value, sortOrder.value)
})

const filteredGroups = computed(() => {
  return filterNotebookAttrGroups(
    sortedGroups.value,
    attrNameFilter.value,
    isIgnoreActive.value ? compiledIgnoreRegexes.value : undefined,
  )
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

function openIgnoreAttrDialog() {
  const switchChecked = ignoreEnabled.value ? 'checked' : ''
  const currentText = ignorePatterns.value.join('\n')

  const html = `<div class="spm-dialog spm-ignore-dialog">
    <div class="spm-ignore-dialog__switch-row">
      <div class="spm-ignore-dialog__switch-title">
        <span>${escapeHtml(t('ignoreAttrSwitch'))}</span>
        <span class="spm-help-icon" title="${escapeHtml(t('ignoreAttrHelpTooltip'))}" aria-label="${escapeHtml(t('ignoreAttrHelpTooltip'))}">
          <svg class="spm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </span>
      </div>
      <input type="checkbox" id="spm-ignore-toggle" class="b3-switch fn__flex-center" ${switchChecked}>
    </div>
    <div class="spm-ignore-dialog__hint">${escapeHtml(t('ignoreAttrHint'))}</div>
    <div class="spm-ignore-dialog__actions-row">
      <button class="b3-button b3-button--outline spm-ignore-dialog__preset-btn" id="spm-ignore-preset-dailynote" type="button">
        ${escapeHtml(t('ignoreAttrPresetDailyNote'))}
      </button>
    </div>
    <textarea
      id="spm-ignore-textarea"
      class="b3-text-field spm-ignore-dialog__textarea"
      placeholder="${escapeHtml(t('ignoreAttrPlaceholder'))}"
    >${escapeHtml(currentText)}</textarea>
    <div id="spm-ignore-error" class="spm-ignore-dialog__error-msg" style="display: none;"></div>
    <div class="spm-ignore-dialog__preview-box">
      <div class="spm-ignore-dialog__preview-title">
        <span id="spm-ignore-preview-count"></span>
      </div>
      <div id="spm-ignore-preview-list" class="spm-ignore-dialog__preview-list"></div>
    </div>
    <div class="spm-dialog__actions">
      <button class="b3-button b3-button--cancel" data-action="cancel">${t('cancel')}</button>
      <button class="b3-button b3-button--text" data-action="ok">${t('ok')}</button>
    </div>
  </div>`

  const dialog = new Dialog({
    title: t('ignoreAttrDialogTitle'),
    content: html,
    width: '460px',
  })

  const getToggle = () => dialog.element.querySelector('#spm-ignore-toggle') as HTMLInputElement | null
  const getTextarea = () => dialog.element.querySelector('#spm-ignore-textarea') as HTMLTextAreaElement | null
  const getErrorEl = () => dialog.element.querySelector('#spm-ignore-error') as HTMLElement | null
  const getCountEl = () => dialog.element.querySelector('#spm-ignore-preview-count') as HTMLElement | null
  const getListEl = () => dialog.element.querySelector('#spm-ignore-preview-list') as HTMLElement | null
  const getPresetBtn = () => dialog.element.querySelector('#spm-ignore-preset-dailynote') as HTMLButtonElement | null

  const updatePreview = () => {
    const isEnabled = getToggle()?.checked ?? true
    const text = getTextarea()?.value ?? ''
    const lines = text.split('\n')
    const validPatterns: string[] = []
    let syntaxError: string | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || line.startsWith('#'))
        continue
      try {
        new RegExp(line, 'i')
        validPatterns.push(line)
      }
      catch (err: any) {
        if (!syntaxError) {
          syntaxError = t('ignoreAttrInvalidRegex')
            .replace('{line}', String(i + 1))
            .replace('{error}', err?.message ?? String(err))
        }
      }
    }

    const errEl = getErrorEl()
    if (errEl) {
      if (syntaxError) {
        errEl.textContent = syntaxError
        errEl.style.display = 'block'
      }
      else {
        errEl.style.display = 'none'
      }
    }

    const countEl = getCountEl()
    const listEl = getListEl()
    if (!countEl || !listEl)
      return

    if (!isEnabled || validPatterns.length === 0) {
      countEl.textContent = t('ignoreAttrNoMatch')
      listEl.innerHTML = ''
      return
    }

    const regexes = compileRegexPatterns(validPatterns)
    const matched = getIgnoredAttrGroups(groups.value, regexes)

    countEl.textContent = matched.length > 0
      ? t('ignoreAttrMatchedCount').replace('{count}', String(matched.length))
      : t('ignoreAttrNoMatch')

    const maxTags = 25
    const tagsHtml = matched.slice(0, maxTags).map((g) => {
      const displayName = g.name.startsWith(CUSTOM_KEY_PREFIX) ? g.name.slice(CUSTOM_KEY_PREFIX.length) : g.name
      return `<span class="spm-ignore-dialog__preview-tag" title="${escapeHtml(g.name)}">${escapeHtml(displayName)}</span>`
    }).join('')

    const moreText = matched.length > maxTags
      ? `<span style="font-size: 11px; color: var(--b3-theme-on-surface-light); align-self: center;">+${matched.length - maxTags}</span>`
      : ''

    listEl.innerHTML = tagsHtml + moreText
  }

  setTimeout(() => {
    updatePreview()

    getTextarea()?.addEventListener('input', updatePreview)
    getToggle()?.addEventListener('change', updatePreview)

    getPresetBtn()?.addEventListener('click', () => {
      const textarea = getTextarea()
      if (!textarea) return
      const current = textarea.value.trim()
      const pattern = '^dailynote-.*'
      if (!current.includes(pattern)) {
        textarea.value = current ? `${current}\n${pattern}` : pattern
        updatePreview()
      }
    })

    dialog.element.querySelector('[data-action="ok"]')?.addEventListener('click', async () => {
      const isEnabled = getToggle()?.checked ?? true
      const text = getTextarea()?.value ?? ''
      const patterns = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      ignoreEnabled.value = isEnabled
      ignorePatterns.value = patterns

      await (plugin as any).saveSettings({
        notebookAttrIgnorePatterns: patterns,
        notebookAttrIgnoreEnabled: isEnabled,
      })

      dialog.destroy()
      showMessage(t('saveSuccess') || '保存成功', 2000, 'info')
    })

    dialog.element.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      dialog.destroy()
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
</script>
