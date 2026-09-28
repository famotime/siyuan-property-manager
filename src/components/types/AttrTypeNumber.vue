<template>
  <div class="spm-type-number" :class="{ 'spm-type-number--editing': editing }">
    <template v-if="editing">
      <input
        ref="inputEl"
        v-model="draft"
        class="b3-text-field spm-row__editor"
        type="number"
        step="any"
        @blur="onBlur"
        @keydown.esc.prevent="onCancel"
        @keydown.enter.prevent="onCommit"
      />
    </template>
    <template v-else>
      <span
        class="spm-row__display spm-type-number__display"
        :class="{ 'spm-row__display--empty': !modelValue, 'spm-row__display--readonly': readonly }"
        :title="readonly ? modelValue : emptyHint"
        @click.stop="enterEdit"
      >
        <span v-if="modelValue" class="spm-type-number__badge">{{ modelValue }}</span>
        <span v-else>{{ displayValue }}</span>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, nextTick, ref, watch } from 'vue'

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
const inputEl = ref<HTMLInputElement | null>(null)
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
    inputEl.value?.select()
  })
}

function onCommit() {
  if (!editing.value)
    return
  editing.value = false
  emit('editChange', false)
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
  draft.value = props.modelValue
  emit('cancel')
}

defineExpose({ enterEdit })
</script>
