<template>
  <div class="spm-type-text" :class="{ 'spm-type-text--editing': editing }">
    <template v-if="editing">
      <textarea
        v-if="multiline"
        ref="inputEl"
        v-model="draft"
        class="b3-text-field spm-row__editor"
        rows="3"
        @blur="consumeBlur"
        @keydown.esc.prevent="cancelEdit"
        @keydown.enter.ctrl.prevent="commitEdit"
        @keydown.enter.meta.prevent="commitEdit"
      />
      <div v-else class="spm-row__editor-wrapper">
        <input
          ref="inputEl"
          v-model="draft"
          class="b3-text-field spm-row__editor"
          type="text"
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
      <!-- 链接值：点击直接跳转，另留一个编辑按钮（单击跳转后仍需可编辑） -->
      <span
        v-if="linkUrl"
        class="spm-row__display spm-type-text__link-row"
        :class="{ 'spm-row__display--readonly': readonly }"
      >
        <a
          class="spm-type-text__link"
          :href="linkUrl"
          :title="linkUrl"
          @click.stop.prevent="openLink"
        >{{ displayValue }}</a>
        <button
          v-if="!readonly"
          class="spm-type-text__edit-btn"
          type="button"
          :title="t('clickToEdit')"
          @click.stop="enterEdit"
        >
          <svg
            class="spm-icon"
            viewBox="0 0 24 24"
          ><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
      </span>
      <span
        v-else
        class="spm-row__display"
        :class="{ 'spm-row__display--empty': !modelValue, 'spm-row__display--readonly': readonly }"
        :title="readonly ? modelValue : emptyHint"
        @click.stop="enterEdit"
      >{{ displayValue }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, ref, toRef } from 'vue'
import AutocompleteDropdown from '../AutocompleteDropdown.vue'
import { useInlineEdit } from '@/composables/useInlineEdit'
import { useValueSuggest } from '@/composables/useValueSuggest'
import {
  isMultiline,
  resolveExternalUrl,
} from '@/utils/dom'

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

const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
const multiline = computed(() => isMultiline(props.modelValue))

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
  onCommit: (next) => {
    emit('update:modelValue', next)
    emit('commit', next)
  },
  onCancel: () => {
    emit('cancel')
  },
})

// ---- 单行编辑态的历史值联想（内部属性与多行文本不联想） ----
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

const displayValue = computed(() => props.modelValue || t('emptyValue'))
const emptyHint = computed(() => props.emptyHint || (props.modelValue ? props.modelValue : t('clickToEdit')))
/** 值为外部链接时非空，展示态渲染为可点击链接。 */
const linkUrl = computed(() => resolveExternalUrl(props.modelValue))

function openLink() {
  if (!linkUrl.value)
    return
  // 思源 Electron 会拦截并以系统浏览器打开外部链接；浏览器端为新标签页。
  window.open(linkUrl.value, '_blank', 'noopener,noreferrer')
}

defineExpose({ enterEdit })
</script>
