<template>
  <div ref="containerEl" class="spm-type-date">
    <div
      class="spm-row__display spm-type-date__trigger"
      :class="{
        'spm-row__display--empty': !modelValue,
        'spm-row__display--readonly': readonly,
        'spm-type-date__trigger--active': open,
      }"
      :title="readonly ? modelValue : (modelValue || t('clickToPickDate'))"
      @click="togglePicker"
    >
      <svg class="spm-icon spm-type-date__icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      <span v-if="modelValue" class="spm-type-date__text">{{ modelValue }}</span>
      <span v-else class="spm-type-date__placeholder">{{ t('clickToPickDate') }}</span>
    </div>

    <!-- 日期选择浮层 -->
    <div v-if="open && !readonly" class="spm-dropdown spm-type-date__dropdown">
      <div class="spm-type-date__quick">
        <button class="b3-button b3-button--text" type="button" @click="pickToday">{{ t('dateToday') }}</button>
        <button class="b3-button b3-button--text" type="button" @click="pickTomorrow">{{ t('dateTomorrow') }}</button>
        <button class="b3-button b3-button--text" type="button" @click="pickYesterday">{{ t('dateYesterday') }}</button>
      </div>

      <div class="spm-type-date__input-wrapper">
        <input
          ref="dateInputEl"
          v-model="dateDraft"
          class="b3-text-field"
          type="date"
          @change="onDateInputChange"
          @keydown.esc.prevent="closePicker"
          @keydown.enter.prevent="onConfirm"
        />
      </div>

      <div v-if="modelValue" class="spm-dropdown__footer">
        <button class="spm-dropdown__clear-btn" type="button" @click="clearDate">
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          {{ t('clearDate') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject, nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  readonly?: boolean
  attrKey: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
  (e: 'commit', val: string): void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const containerEl = ref<HTMLElement | null>(null)
const dateInputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)
const dateDraft = ref('')

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function togglePicker() {
  if (props.readonly)
    return
  if (open.value) {
    closePicker()
  }
  else {
    openPicker()
  }
}

function openPicker() {
  open.value = true
  // 如果当前值包含 YYYY-MM-DD，提取前 10 位给 date input
  dateDraft.value = props.modelValue.slice(0, 10)
  nextTick(() => {
    dateInputEl.value?.focus()
    document.addEventListener('click', onClickOutside)
  })
}

function closePicker() {
  open.value = false
  document.removeEventListener('click', onClickOutside)
}

function onClickOutside(e: MouseEvent) {
  if (containerEl.value && !containerEl.value.contains(e.target as Node)) {
    closePicker()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

function onDateInputChange() {
  if (dateDraft.value) {
    commitValue(dateDraft.value)
  }
}

function onConfirm() {
  if (dateDraft.value) {
    commitValue(dateDraft.value)
  }
}

function pickToday() {
  commitValue(formatDate(new Date()))
}

function pickTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  commitValue(formatDate(d))
}

function pickYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  commitValue(formatDate(d))
}

function clearDate() {
  commitValue('')
}

function commitValue(val: string) {
  emit('update:modelValue', val)
  emit('commit', val)
  closePicker()
}
</script>
