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
          @blur="onBlur"
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
import { computed, inject, nextTick, ref, toRef, watch } from 'vue'
import AutocompleteDropdown from '../AutocompleteDropdown.vue'
import { useAttrSchema } from '@/composables/useAttrSchema'
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

const editing = ref(false)
const draft = ref(props.modelValue)
const inputEl = ref<HTMLInputElement | null>(null)
let justEntered = false

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
  onCommit()
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
  onCommit()
}

function onEsc() {
  if (suggestOpen.value) {
    closeSuggestions()
    return
  }
  onCancel()
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

watch(() => props.modelValue, (next) => {
  draft.value = next
})

function enterEdit() {
  if (props.readonly || editing.value)
    return
  draft.value = props.modelValue
  editing.value = true
  justEntered = true
  emit('editChange', true)
  setTimeout(() => {
    justEntered = false
  }, 200)
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

function onCommit() {
  if (!editing.value)
    return
  editing.value = false
  emit('editChange', false)
  closeSuggestions()
  const trimmed = draft.value.trim()
  emit('update:modelValue', trimmed)
  emit('commit', trimmed)
}

function onBlur() {
  if (justEntered)
    return
  onCommit()
}

function onCancel() {
  editing.value = false
  emit('editChange', false)
  closeSuggestions()
  draft.value = props.modelValue
  emit('cancel')
}

defineExpose({ enterEdit })
</script>
