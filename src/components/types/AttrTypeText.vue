<template>
  <div class="spm-type-text" :class="{ 'spm-type-text--editing': editing }">
    <template v-if="editing">
      <textarea
        v-if="multiline"
        ref="inputEl"
        v-model="draft"
        class="b3-text-field spm-row__editor"
        rows="3"
        @blur="onBlur"
        @keydown.esc.prevent="onCancel"
        @keydown.enter.ctrl.prevent="onCommit"
        @keydown.enter.meta.prevent="onCommit"
      />
      <input
        v-else
        ref="inputEl"
        v-model="draft"
        class="b3-text-field spm-row__editor"
        type="text"
        @blur="onBlur"
        @keydown.esc.prevent="onCancel"
        @keydown.enter.prevent="onCommit"
      />
    </template>
    <template v-else>
      <span
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
import { computed, inject, nextTick, ref, watch } from 'vue'
import { isMultiline } from '@/utils/dom'

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

const editing = ref(false)
const draft = ref(props.modelValue)
const multiline = computed(() => isMultiline(props.modelValue))
const inputEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)
let justEntered = false

const displayValue = computed(() => props.modelValue || t('emptyValue'))
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
    if (typeof (inputEl.value as HTMLInputElement)?.select === 'function')
      (inputEl.value as HTMLInputElement).select()
  })
}

function onCommit() {
  if (!editing.value)
    return
  editing.value = false
  emit('editChange', false)
  const next = draft.value
  emit('update:modelValue', next)
  emit('commit', next)
}

function onBlur() {
  if (justEntered)
    return
  onCommit()
}

function onCancel() {
  editing.value = false
  emit('editChange', false)
  draft.value = props.modelValue
  emit('cancel')
}

defineExpose({ enterEdit })
</script>
