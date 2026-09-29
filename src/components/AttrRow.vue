<template>
  <div
    class="spm-row"
    :class="{
      'spm-row--readonly': readonly,
      'spm-row--editing': isEditingValue || editingKeyName,
      'spm-row--saving': state === 'saving',
      'spm-row--error': state === 'error',
    }"
  >
    <div class="spm-row__key" :title="row.key">
      <span v-if="readonly" class="spm-row__lock" :title="readonlyTooltip">
        <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24" style="opacity: 0.6; display: inline-block; vertical-align: middle; margin-right: 2px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </span>
      <AttrTypeMenu
        v-else-if="isCustom"
        :current-type="resolvedType"
        :attr-key="row.key"
        @change-type="onChangeType"
      />
      <!-- 属性名编辑态与展示态 -->
      <template v-if="editingKeyName">
        <input
          ref="keyInputEl"
          v-model="keyDraft"
          class="b3-text-field spm-row__key-editor"
          type="text"
          @blur="commitRenameKey"
          @keydown.enter.prevent="commitRenameKey"
          @keydown.esc.prevent="cancelRenameKey"
        />
      </template>
      <div v-else class="spm-row__key-text-wrapper">
        <span
          class="spm-row__key-text"
          :title="isCustom ? t('keyRenameHint') : displayLabel"
          @dblclick="startEditKeyName"
        >{{ displayLabel }}</span>
        <button
          v-if="isCustom && !readonly"
          class="spm-row__key-edit-btn"
          type="button"
          :title="t('renameAttr')"
          @click.stop="startEditKeyName"
        >
          <svg class="spm-icon" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
      </div>
    </div>

    <div class="spm-row__value">
      <AttrTypeCheckbox
        v-if="resolvedType === 'checkbox'"
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @commit="onCommitValue"
      />
      <AttrTypeSelect
        v-else-if="resolvedType === 'select'"
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @commit="onCommitValue"
      />
      <AttrTypeMultiSelect
        v-else-if="resolvedType === 'multi-select'"
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @commit="onCommitValue"
      />
      <AttrTypeDate
        v-else-if="resolvedType === 'date'"
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @commit="onCommitValue"
      />
      <AttrTypeNumber
        v-else-if="resolvedType === 'number'"
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @edit-change="onEditChange"
        @commit="onCommitValue"
      />
      <AttrTypeBlockRef
        v-else-if="resolvedType === 'block-ref'"
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @commit="onCommitValue"
      />
      <AttrTypeText
        v-else
        :model-value="value"
        :attr-key="row.key"
        :readonly="readonly"
        @edit-change="onEditChange"
        @commit="onCommitValue"
      />
    </div>

    <div class="spm-row__trail">
      <span v-if="state === 'saving'" class="spm-row__indicator spm-row__indicator--saving" :title="t('savingHint')" />
      <span v-else-if="state === 'success'" class="spm-row__indicator spm-row__indicator--success" :title="t('savedHint')">
        <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </span>
      <span v-else-if="state === 'error'" class="spm-row__indicator spm-row__indicator--error" :title="errorMessage || t('saveError')">
        <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </span>
      <button
        v-if="!isEmpty"
        class="spm-row__copy"
        type="button"
        :title="t('copyAttr')"
        @click.stop="onCopy"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
      <button
        v-if="deletable"
        class="spm-row__delete"
        type="button"
        :title="t('deleteAttr')"
        @click.stop="$emit('delete', row.key)"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { AttrRowVM } from '@/composables/useBlockAttrs'
import type { AttrType } from '@/types/schema'
import { computed, inject, nextTick, ref, toRefs, watch } from 'vue'
import AttrTypeBlockRef from './types/AttrTypeBlockRef.vue'
import AttrTypeCheckbox from './types/AttrTypeCheckbox.vue'
import AttrTypeDate from './types/AttrTypeDate.vue'
import AttrTypeMenu from './types/AttrTypeMenu.vue'
import AttrTypeMultiSelect from './types/AttrTypeMultiSelect.vue'
import AttrTypeNumber from './types/AttrTypeNumber.vue'
import AttrTypeSelect from './types/AttrTypeSelect.vue'
import AttrTypeText from './types/AttrTypeText.vue'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { CUSTOM_KEY_PREFIX, isCustomKey, isValidCustomSuffix } from '@/constants/attrs'
import { DEFAULT_PRESET_SCHEMAS } from '@/constants/schema'

const props = defineProps<{
  row: AttrRowVM
  /** 行标签，默认显示 row.key；自定义属性时父级可传去前缀的短名。 */
  label?: string
  /** 是否可删除（自定义属性行才显示 ✕）。 */
  deletable?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', key: string, value: string): void
  (e: 'delete', key: string): void
  (e: 'rename', oldKey: string, newKey: string): void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const { resolveAttrType, setAttrType, getSchema } = useAttrSchema()

const { row } = toRefs(props)
const readonly = computed(() => row.value.readonly)
const value = computed(() => row.value.value)
const label = computed(() => props.label ?? row.value.key)
const isCustom = computed(() => isCustomKey(row.value.key))
const isEmpty = computed(() => !value.value)
const readonlyTooltip = computed(() => t('readonlyTooltip'))

const shortKey = computed(() => {
  return props.label ?? (row.value.key.startsWith(CUSTOM_KEY_PREFIX) ? row.value.key.slice(CUSTOM_KEY_PREFIX.length) : row.value.key)
})

const displayLabel = computed(() => {
  if (!isCustom.value)
    return label.value
  const sk = shortKey.value
  const schema = getSchema(row.value.key) || DEFAULT_PRESET_SCHEMAS[row.value.key]
  const schemaLabel = schema?.label
  if (schemaLabel && schemaLabel !== sk) {
    return `${sk} (${schemaLabel})`
  }
  return sk
})

const resolvedType = computed(() => {
  if (!isCustom.value)
    return 'text'
  return resolveAttrType(row.value.key, value.value)
})

type SaveState = 'idle' | 'saving' | 'success' | 'error'
const state = ref<SaveState>('idle')
const errorMessage = ref('')
let successTimer: number | undefined

const isEditingValue = ref(false)
const editingKeyName = ref(false)
const keyDraft = ref('')
const keyInputEl = ref<HTMLInputElement | null>(null)

function onEditChange(editing: boolean) {
  isEditingValue.value = editing
}

function startEditKeyName() {
  if (readonly.value || !isCustom.value)
    return
  editingKeyName.value = true
  keyDraft.value = shortKey.value
  nextTick(() => {
    keyInputEl.value?.focus()
    keyInputEl.value?.select()
  })
}

function cancelRenameKey() {
  editingKeyName.value = false
  keyDraft.value = ''
}

function commitRenameKey() {
  if (!editingKeyName.value)
    return
  const nextSuffix = keyDraft.value.trim()
  if (!nextSuffix || !isValidCustomSuffix(nextSuffix)) {
    cancelRenameKey()
    return
  }
  const nextFullKey = CUSTOM_KEY_PREFIX + nextSuffix
  if (nextFullKey !== row.value.key) {
    emit('rename', row.value.key, nextFullKey)
  }
  editingKeyName.value = false
  keyDraft.value = ''
}

function clearSuccessTimer() {
  if (successTimer) {
    window.clearTimeout(successTimer)
    successTimer = undefined
  }
}

function onCommitValue(nextVal: string) {
  if (nextVal === value.value)
    return
  emit('save', row.value.key, nextVal)
}

function onChangeType(nextType: AttrType) {
  setAttrType(row.value.key, nextType)
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(value.value)
  }
  catch {
    // 静默失败
  }
}

watch(value, (next, prev) => {
  if (state.value === 'saving' && next !== prev) {
    state.value = 'success'
    clearSuccessTimer()
    successTimer = window.setTimeout(() => {
      if (state.value === 'success')
        state.value = 'idle'
    }, 1200)
  }
})

function markSaving() {
  state.value = 'saving'
  errorMessage.value = ''
}

function markError(message: string) {
  state.value = 'error'
  errorMessage.value = message
  clearSuccessTimer()
}

defineExpose({ markSaving, markError })
</script>
