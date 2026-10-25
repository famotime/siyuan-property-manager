<template>
  <div class="spm-type-number" :class="{ 'spm-type-number--editing': editing }">
    <template v-if="editing">
      <div class="spm-row__editor-wrapper">
        <input
          ref="inputEl"
          v-model="draft"
          class="b3-text-field spm-row__editor"
          type="number"
          step="any"
          @input="onInput"
          @focus="onFocus"
          @blur="consumeBlur"
          @keydown.down.prevent="navDown"
          @keydown.up.prevent="navUp"
          @keydown.enter.prevent="onEnter"
          @keydown.esc.prevent="onEsc"
        />
        <!-- 高频历史值联想浮层 -->
        <AutocompleteDropdown
          :open="suggestOpen"
          :items="suggestItems"
          :highlight-index="suggestHighlightIndex"
          @select="onPickSuggestion"
        />
      </div>
    </template>
    <template v-else>
      <span
        class="spm-row__display spm-type-number__display"
        :class="{ 'spm-row__display--empty': !modelValue, 'spm-row__display--readonly': readonly }"
        :title="readonly ? modelValue : emptyHint"
        @click.stop="enterEdit"
      >
        <span v-if="modelValue" class="spm-type-number__badge">{{ displayValue }}</span>
        <span v-else>{{ t('emptyValue') }}</span>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref, toRef } from 'vue'
import AutocompleteDropdown from '../AutocompleteDropdown.vue'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { useInlineEdit } from '@/composables/useInlineEdit'
import { useValueSuggest } from '@/composables/useValueSuggest'
import { DEFAULT_PRESET_SCHEMAS } from '@/constants/schema'
import { formatNumberDisplay } from '@/utils/valueFormat'

const props = defineProps<{
  modelValue: string
  readonly?: boolean
  attrKey: string
  emptyHint?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'commit', val: string): void
  (e: 'cancel'): void
  (e: 'editChange', isEditing: boolean): void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const { getSchema } = useAttrSchema()

const inputEl = ref<HTMLInputElement | null>(null)

const {
  editing,
  draft,
  enterEdit,
  commit: commitEdit,
  cancel: cancelEdit,
  consumeBlur,
} = useInlineEdit({
  modelValue: () => props.modelValue,
  isReadonly: () => props.readonly === true,
  inputEl,
  onEditChange: (editing) => {
    emit('editChange', editing)
  },
  beforeExit: () => closeSuggestions(),
  transformCommit: d => d.trim(),
  onCommit: (next) => {
    emit('update:modelValue', next)
    emit('commit', next)
  },
  onCancel: () => {
    emit('cancel')
  },
})

// ---- 编辑态的历史值联想（仅 custom- 属性） ----
const {
  items: suggestItems,
  open: suggestOpen,
  highlightIndex: suggestHighlightIndex,
  refresh: refreshSuggestions,
  schedule: scheduleSuggestions,
  close: closeSuggestions,
  navDown,
  navUp,
  pickHighlighted: pickHighlightedSuggestion,
  pick: pickSuggestion,
} = useValueSuggest(toRef(props, 'attrKey'), draft, (val) => {
  draft.value = val
  commitEdit()
})

function onInput() {
  scheduleSuggestions()
}

function onFocus() {
  void refreshSuggestions()
}

function onEnter() {
  if (pickHighlightedSuggestion())
    return
  commitEdit()
}

function onEsc() {
  if (suggestOpen.value) {
    closeSuggestions()
    return
  }
  cancelEdit()
}

function onPickSuggestion(val: string) {
  pickSuggestion(val)
}

const numberFormat = computed(() => {
  const schema = getSchema(props.attrKey) || DEFAULT_PRESET_SCHEMAS[props.attrKey]
  return schema?.numberFormat
})

/** 展示态按 Schema numberFormat 格式化（编辑态始终为原始数字）。 */
const displayValue = computed(() => formatNumberDisplay(props.modelValue, numberFormat.value))
const emptyHint = computed(() => props.emptyHint || (props.modelValue ? props.modelValue : t('clickToEdit')))

defineExpose({ enterEdit })
</script>
