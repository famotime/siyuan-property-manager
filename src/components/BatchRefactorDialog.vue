<template>
  <div class="spm-batch-refactor-dialog">
    <!-- 顶部目标范围切换 -->
    <div class="spm-refactor-tabs">
      <button
        class="spm-refactor-tab"
        :class="{ 'spm-refactor-tab--active': scope === 'key' }"
        type="button"
        @click="switchScope('key')"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><path d="M21 2l-2 2m-6 6l7-7M3 10a7 7 0 1 0 14 0 7 7 0 1 0-14 0zm10 0l-3 3m0 0l-2-2m2 2l-2 2"></path></svg>
        <span>{{ t('refactorScopeKey') }}</span>
      </button>
      <button
        class="spm-refactor-tab"
        :class="{ 'spm-refactor-tab--active': scope === 'value' }"
        type="button"
        @click="switchScope('value')"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>
        <span>{{ t('refactorScopeValue') }}</span>
      </button>
    </div>

    <!-- 属性名模式配置表单 -->
    <div v-if="scope === 'key'" class="spm-refactor-form">
      <div class="spm-refactor-form__row">
        <label class="spm-refactor-form__label">{{ t('matchMode') }}</label>
        <select v-model="keyMatchMode" class="b3-select spm-refactor-form__select">
          <option value="prefix">{{ t('matchModePrefix') }}</option>
          <option value="exact">{{ t('matchModeExact') }}</option>
          <option value="contains">{{ t('matchModeContains') }}</option>
          <option value="regex">{{ t('matchModeRegex') }}</option>
        </select>
        <label class="spm-refactor-form__checkbox-label">
          <input v-model="keyMatchCase" type="checkbox" class="b3-switch fn__flex-center">
          <span>{{ t('matchCase') }}</span>
        </label>
      </div>

      <div class="spm-refactor-form__row">
        <label class="spm-refactor-form__label">{{ t('searchPattern') }}</label>
        <input
          v-model="keySearch"
          type="text"
          class="b3-text-field fn__flex-1"
          :placeholder="keyMatchMode === 'prefix' ? 'slide' : (keyMatchMode === 'regex' ? '^slide-(.*)$' : 'slide')"
          autofocus
        >
      </div>

      <div class="spm-refactor-form__row">
        <label class="spm-refactor-form__label">{{ t('replaceText') }}</label>
        <input
          v-model="keyReplace"
          type="text"
          class="b3-text-field fn__flex-1"
          :placeholder="keyMatchMode === 'prefix' ? 'slides' : (keyMatchMode === 'regex' ? 'presentation-$1' : 'slides')"
        >
      </div>

      <div v-if="keyRegexError" class="spm-refactor-form__error">
        {{ keyRegexError }}
      </div>

      <div v-if="hasIgnoreRules" class="spm-refactor-form__row spm-refactor-form__ignore-row">
        <label class="spm-refactor-form__checkbox-label">
          <input v-model="keyExcludeIgnored" type="checkbox" class="b3-switch fn__flex-center">
          <span>{{ t('excludeIgnored') }}</span>
        </label>
        <span v-if="keyPlan.ignoredCount > 0" class="spm-refactor-form__ignore-count">
          {{ t('excludeIgnoredSummary').replace('{count}', String(keyPlan.ignoredCount)) }}
        </span>
      </div>
    </div>

    <!-- 属性值模式配置表单 -->
    <div v-else class="spm-refactor-form">
      <div class="spm-refactor-form__row">
        <label class="spm-refactor-form__label">{{ t('targetAttr') }}</label>
        <select v-model="valueTargetAttr" class="b3-select fn__flex-1">
          <option value="">{{ t('allAttrs') }}</option>
          <option v-for="g in availableAttrGroups" :key="g.name" :value="g.name">
            {{ formatAttrDisplayName(g.name) }} ({{ g.values.length }})
          </option>
        </select>
        <div v-if="valueTargetAttr" class="spm-refactor-form__mode-radios">
          <label class="spm-refactor-form__radio-label">
            <input v-model="valueOpMode" type="radio" value="replace">
            <span>{{ t('valueOpReplace') }}</span>
          </label>
          <label class="spm-refactor-form__radio-label">
            <input v-model="valueOpMode" type="radio" value="merge">
            <span>{{ t('valueOpMerge') }}</span>
          </label>
        </div>
      </div>

      <!-- 多值合并视图 -->
      <template v-if="valueTargetAttr && valueOpMode === 'merge'">
        <div class="spm-refactor-form__row spm-refactor-form__row--col">
          <label class="spm-refactor-form__label">{{ t('selectOldValues') }}</label>
          <div class="spm-refactor-merge-tags">
            <label
              v-for="v in targetGroupValues"
              :key="v.value"
              class="spm-refactor-merge-tag"
              :class="{ 'spm-refactor-merge-tag--active': valueSelectedOldValues.includes(v.value) }"
            >
              <input
                type="checkbox"
                :value="v.value"
                :checked="valueSelectedOldValues.includes(v.value)"
                @change="toggleOldValueSelect(v.value)"
              >
              <span class="spm-refactor-merge-tag__text">{{ v.value || '·' }}</span>
              <span class="spm-refactor-merge-tag__count">{{ v.count }}</span>
            </label>
          </div>
        </div>

        <div class="spm-refactor-form__row">
          <label class="spm-refactor-form__label">{{ t('targetNewValue') }}</label>
          <input
            v-model="valueTargetNewValue"
            type="text"
            class="b3-text-field fn__flex-1"
            :placeholder="t('targetNewValuePlaceholder')"
          >
        </div>
      </template>

      <!-- 查找替换视图 -->
      <template v-else>
        <div class="spm-refactor-form__row">
          <label class="spm-refactor-form__label">{{ t('searchPattern') }}</label>
          <input
            v-model="valueSearch"
            type="text"
            class="b3-text-field fn__flex-1"
            :placeholder="t('searchPattern')"
            autofocus
          >
          <label class="spm-refactor-form__checkbox-label">
            <input v-model="valueIsRegex" type="checkbox" class="b3-switch fn__flex-center">
            <span>{{ t('isRegex') }}</span>
          </label>
          <label class="spm-refactor-form__checkbox-label">
            <input v-model="valueMatchCase" type="checkbox" class="b3-switch fn__flex-center">
            <span>{{ t('matchCase') }}</span>
          </label>
        </div>

        <div class="spm-refactor-form__row">
          <label class="spm-refactor-form__label">{{ t('replaceText') }}</label>
          <input
            v-model="valueReplace"
            type="text"
            class="b3-text-field fn__flex-1"
            :placeholder="t('replaceText')"
          >
        </div>

        <div v-if="valueRegexError" class="spm-refactor-form__error">
          {{ valueRegexError }}
        </div>

        <div v-if="!valueReplace.trim() && valueSearch.trim()" class="spm-refactor-form__hint">
          <svg class="spm-icon" width="13" height="13" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{{ t('clearValueHint') }}</span>
        </div>

        <div v-if="hasIgnoreRules" class="spm-refactor-form__row spm-refactor-form__ignore-row">
          <label class="spm-refactor-form__checkbox-label">
            <input v-model="valueExcludeIgnored" type="checkbox" class="b3-switch fn__flex-center">
            <span>{{ t('excludeIgnored') }}</span>
          </label>
          <span v-if="valuePlan.ignoredCount > 0" class="spm-refactor-form__ignore-count">
            {{ t('excludeIgnoredSummary').replace('{count}', String(valuePlan.ignoredCount)) }}
          </span>
        </div>
      </template>
    </div>

    <!-- 影响面预览清单 (Safe Staging List) -->
    <div class="spm-refactor-staging">
      <div class="spm-refactor-staging__header">
        <label class="spm-refactor-staging__select-all">
          <input
            type="checkbox"
            :checked="isAllSelected"
            :indeterminate="isPartialSelected"
            @change="toggleSelectAll"
          >
          <span class="spm-refactor-staging__title">{{ t('previewStaging') }}</span>
        </label>
        <span class="spm-refactor-staging__summary">
          {{ t('previewSelectedSummary')
            .replace('{selected}', String(selectedIndices.size))
            .replace('{total}', String(activeItems.length))
            .replace('{blocks}', String(activeBlocksCount))
          }}
        </span>
      </div>

      <div class="spm-refactor-staging__list">
        <div v-if="activeItems.length === 0" class="spm-refactor-staging__empty">
          {{ t('noMatchingItems') }}
        </div>
        <template v-else>
          <div
            v-for="(item, idx) in activeItems"
            :key="idx"
            class="spm-refactor-staging__item"
            :class="{ 'spm-refactor-staging__item--conflict': item.hasConflict }"
          >
            <input
              type="checkbox"
              class="spm-refactor-staging__checkbox"
              :checked="selectedIndices.has(idx)"
              @change="toggleItemSelect(idx)"
            >
            <div class="spm-refactor-staging__item-content">
              <span class="spm-refactor-staging__diff">
                <span class="spm-refactor-staging__old" :title="item.oldLabel">{{ item.oldLabel }}</span>
                <span class="spm-refactor-staging__arrow">➜</span>
                <span class="spm-refactor-staging__new" :title="item.newLabel">{{ item.newLabel }}</span>
              </span>
              <span v-if="item.attrLabel" class="spm-refactor-staging__attr-tag">
                {{ item.attrLabel }}
              </span>
              <span v-if="item.hasConflict" class="spm-refactor-staging__badge spm-refactor-staging__badge--conflict" :title="t('conflictWarningTooltip')">
                <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                {{ t('conflictWarning') }}
              </span>
              <span v-if="item.isIgnored" class="spm-refactor-staging__badge spm-refactor-staging__badge--ignored">
                {{ t('ignoredTag') }}
              </span>
            </div>
            <span class="spm-refactor-staging__count">
              {{ item.blockCount }} {{ t('batchRenameConfirmBlockCount').replace('{count}', '') }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <!-- 底部操作与元数据级联联动 -->
    <div class="spm-refactor-footer">
      <div class="spm-refactor-footer__left">
        <label v-if="scope === 'key'" class="spm-refactor-footer__cascade">
          <input v-model="cascadeMetadata" type="checkbox" class="b3-switch fn__flex-center">
          <span>{{ t('cascadeMetadata') }}</span>
        </label>
      </div>

      <div class="spm-refactor-footer__actions">
        <button class="b3-button b3-button--cancel" type="button" @click="handleClose">
          {{ t('cancel') }}
        </button>
        <button
          class="b3-button b3-button--text"
          type="button"
          :disabled="selectedIndices.size === 0 || isExecuting"
          @click="executeBatchRefactor"
        >
          <span v-if="isExecuting">{{ t('executing') }}</span>
          <span v-else>{{ t('executeRefactor') }} ({{ selectedBlocksCount }})</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref, watch } from 'vue'
import { showMessage } from 'siyuan'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import type { AttrStatGroup } from '@/composables/useSharedStats'
import {
  planKeyRefactor,
  planValueMerge,
  planValueReplace,
  type KeyMatchMode,
  type RefactorScope,
  type ValueOpMode,
} from '@/utils/batchRefactor'
import { batchDeleteAttr, batchEditAttr, batchRenameAttrKey } from '@/composables/useNotebookAttrStats'
import { renameAttrKeyEverywhere } from '@/composables/useAttrRename'

const props = withDefaults(
  defineProps<{
    boxId: string
    groups: AttrStatGroup[]
    initialScope?: RefactorScope
    initialTargetKey?: string
    initialSearch?: string
    initialReplace?: string
    initialMatchMode?: KeyMatchMode
    ignoreRegexes?: RegExp[]
  }>(),
  {
    initialScope: 'key',
    initialTargetKey: '',
    initialSearch: '',
    initialReplace: '',
    initialMatchMode: 'prefix',
    ignoreRegexes: () => [],
  },
)

const emit = defineEmits<{
  (e: 'success'): void
  (e: 'close'): void
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

function formatAttrDisplayName(key: string): string {
  return key.startsWith(CUSTOM_KEY_PREFIX) ? key.slice(CUSTOM_KEY_PREFIX.length) : key
}

const hasIgnoreRules = computed(() => (props.ignoreRegexes?.length ?? 0) > 0)

// ---- 表单状态 ----
const scope = ref<RefactorScope>(props.initialScope)
function switchScope(newScope: RefactorScope) {
  scope.value = newScope
}

// 属性名模式参数
const keyMatchMode = ref<KeyMatchMode>(props.initialMatchMode)
const keySearch = ref(props.initialSearch)
const keyReplace = ref(props.initialReplace)
const keyMatchCase = ref(false)
const keyExcludeIgnored = ref(true)

const keyRegexError = computed(() => {
  if (keyMatchMode.value !== 'regex' || !keySearch.value)
    return null
  try {
    new RegExp(keySearch.value)
    return null
  }
  catch (err: any) {
    return t('regexSyntaxError').replace('{error}', err?.message ?? String(err))
  }
})

// 属性值模式参数
const valueTargetAttr = ref(props.initialTargetKey)
const valueOpMode = ref<ValueOpMode>('replace')
const valueSelectedOldValues = ref<string[]>([])
const valueTargetNewValue = ref('')
const valueSearch = ref(props.initialScope === 'value' ? props.initialSearch : '')
const valueReplace = ref(props.initialScope === 'value' ? props.initialReplace : '')
const valueIsRegex = ref(false)
const valueMatchCase = ref(false)
const valueExcludeIgnored = ref(true)

const valueRegexError = computed(() => {
  if (!valueIsRegex.value || !valueSearch.value)
    return null
  try {
    new RegExp(valueSearch.value)
    return null
  }
  catch (err: any) {
    return t('regexSyntaxError').replace('{error}', err?.message ?? String(err))
  }
})

const availableAttrGroups = computed(() => {
  return props.groups.filter(g => g.name.startsWith(CUSTOM_KEY_PREFIX))
})

const targetGroup = computed(() => {
  return props.groups.find(g => g.name === valueTargetAttr.value)
})

const targetGroupValues = computed(() => {
  return targetGroup.value?.values ?? []
})

function toggleOldValueSelect(val: string) {
  const set = new Set(valueSelectedOldValues.value)
  if (set.has(val))
    set.delete(val)
  else
    set.add(val)
  valueSelectedOldValues.value = [...set]
}

// ---- 计算执行规划 (Plans) ----
const keyPlan = computed(() => {
  if (scope.value !== 'key')
    return { valid: false, items: [], invalidKeys: [], ignoredCount: 0, conflictCount: 0 }
  return planKeyRefactor(
    props.groups,
    keySearch.value,
    keyReplace.value,
    keyMatchMode.value,
    {
      matchCase: keyMatchCase.value,
      ignoreRegexes: props.ignoreRegexes,
      excludeIgnored: keyExcludeIgnored.value,
    },
  )
})

const valuePlan = computed(() => {
  if (scope.value !== 'value')
    return { valid: false, items: [], ignoredCount: 0 }

  if (valueTargetAttr.value && valueOpMode.value === 'merge') {
    return planValueMerge(
      props.groups,
      valueTargetAttr.value,
      valueSelectedOldValues.value,
      valueTargetNewValue.value,
    )
  }

  return planValueReplace(
    props.groups,
    valueTargetAttr.value || null,
    valueSearch.value,
    valueReplace.value,
    {
      isRegex: valueIsRegex.value,
      matchCase: valueMatchCase.value,
      ignoreRegexes: props.ignoreRegexes,
      excludeIgnored: valueExcludeIgnored.value,
    },
  )
})

export interface DisplayItem {
  raw: any
  oldLabel: string
  newLabel: string
  attrLabel?: string
  blockCount: number
  hasConflict?: boolean
  isIgnored?: boolean
}

const activeItems = computed<DisplayItem[]>(() => {
  if (scope.value === 'key') {
    return keyPlan.value.items.map(i => ({
      raw: i,
      oldLabel: i.shortOld,
      newLabel: i.shortNew,
      blockCount: i.blockCount,
      hasConflict: i.hasConflict,
      isIgnored: i.isIgnored,
    }))
  }
  return valuePlan.value.items.map(i => ({
    raw: i,
    oldLabel: i.oldValue || '·',
    newLabel: i.newValue || '·',
    attrLabel: i.shortAttrName,
    blockCount: i.blockCount,
    isIgnored: i.isIgnored,
  }))
})

// ---- 暂存列表勾选管理 ----
const selectedIndices = ref<Set<number>>(new Set())

watch(
  () => activeItems.value,
  (items) => {
    // 默认全选所有计算出的匹配项
    selectedIndices.value = new Set(items.map((_, idx) => idx))
  },
  { immediate: true },
)

const isAllSelected = computed(() => {
  return activeItems.value.length > 0 && selectedIndices.value.size === activeItems.value.length
})

const isPartialSelected = computed(() => {
  return selectedIndices.value.size > 0 && selectedIndices.value.size < activeItems.value.length
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIndices.value.clear()
  }
  else {
    selectedIndices.value = new Set(activeItems.value.map((_, idx) => idx))
  }
}

function toggleItemSelect(idx: number) {
  if (selectedIndices.value.has(idx))
    selectedIndices.value.delete(idx)
  else
    selectedIndices.value.add(idx)
}

const activeBlocksCount = computed(() => {
  return activeItems.value.reduce((sum, item) => sum + item.blockCount, 0)
})

const selectedBlocksCount = computed(() => {
  return [...selectedIndices.value].reduce((sum, idx) => {
    return sum + (activeItems.value[idx]?.blockCount ?? 0)
  }, 0)
})

// ---- 底部级联与执行 ----
const cascadeMetadata = ref(true)
const isExecuting = ref(false)

async function executeBatchRefactor() {
  if (selectedIndices.value.size === 0 || isExecuting.value)
    return

  isExecuting.value = true
  let updatedItems = 0
  let updatedBlocks = 0
  let failedBlocks = 0

  try {
    if (scope.value === 'key') {
      for (const idx of selectedIndices.value) {
        const item = keyPlan.value.items[idx]
        if (!item)
          continue
        const { ok, failed } = await batchRenameAttrKey(props.boxId, item.oldKey, item.newKey)
        if (ok > 0) {
          updatedItems++
          updatedBlocks += ok
        }
        failedBlocks += failed
        if (cascadeMetadata.value && (ok > 0 || failed === 0)) {
          // 四方统一协调（SM-101）：块数据已在上方改写，此处迁移 schema/模板/登记表；
          // 仅当改写有块成功或无失败时才级联元数据（全失败时不级联，保持块数据与元数据一致）
          await renameAttrKeyEverywhere(item.oldKey, item.newKey)
        }
      }
    }
    else {
      for (const idx of selectedIndices.value) {
        const item = valuePlan.value.items[idx]
        if (!item)
          continue
        let result = { ok: 0, failed: 0 }
        if (!item.newValue) {
          result = await batchDeleteAttr(props.boxId, item.attrName, item.oldValue)
        }
        else {
          result = await batchEditAttr(props.boxId, item.attrName, item.oldValue, item.newValue)
        }
        if (result.ok > 0) {
          updatedItems++
          updatedBlocks += result.ok
        }
        failedBlocks += result.failed
      }
    }

    showMessage(
      t('refactorSuccess')
        .replace('{items}', String(updatedItems))
        .replace('{blocks}', String(updatedBlocks)),
      3500,
      'info',
    )
    // 失败不再静默折算（SM-118）：聚合后单独提示
    if (failedBlocks > 0) {
      showMessage(
        t('batchPartialFailure')
          .replace('{ok}', String(updatedBlocks))
          .replace('{failed}', String(failedBlocks)),
        4000,
        'error',
      )
    }
    emit('success')
    emit('close')
  }
  catch (err: any) {
    showMessage(t('refactorError') + ': ' + (err?.message ?? String(err)), 4000, 'error')
  }
  finally {
    isExecuting.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>
