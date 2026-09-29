<template>
  <div ref="containerEl" class="spm-type-checkbox">
    <button
      class="spm-toggle"
      :class="{
        'spm-toggle--active': isChecked,
        'spm-toggle--readonly': readonly,
      }"
      type="button"
      :disabled="readonly"
      :title="readonly ? modelValue : (isChecked ? t('toggleFalse') : t('toggleTrue'))"
      @click="toggle"
      @keydown.space.prevent="toggle"
    >
      <span class="spm-toggle__handle" />
    </button>
    <div
      class="spm-type-checkbox__trigger"
      :class="{
        'spm-type-checkbox__trigger--readonly': readonly,
        'spm-type-checkbox__trigger--open': open,
      }"
      :title="readonly ? modelValue : t('booleanSelectHint')"
      @click="toggleDropdown"
    >
      <span class="spm-type-checkbox__label">
        {{ isChecked ? t('checkedTrue') : t('checkedFalse') }}
      </span>
      <svg v-if="!readonly" class="spm-icon spm-type-checkbox__arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>

    <!-- 下拉候选菜单 -->
    <div v-if="open && !readonly" class="spm-dropdown spm-type-checkbox__dropdown">
      <div
        class="spm-dropdown__item"
        :class="{ 'spm-dropdown__item--selected': isChecked }"
        @click="selectValue('true')"
      >
        <span class="spm-type-checkbox__option-text">{{ t('checkedTrue') }}</span>
        <svg v-if="isChecked" class="spm-icon spm-dropdown__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <div
        class="spm-dropdown__item"
        :class="{ 'spm-dropdown__item--selected': !isChecked }"
        @click="selectValue('false')"
      >
        <span class="spm-type-checkbox__option-text">{{ t('checkedFalse') }}</span>
        <svg v-if="!isChecked" class="spm-icon spm-dropdown__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, nextTick, onBeforeUnmount, ref } from 'vue'

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
const open = ref(false)

const isChecked = computed(() => {
  return props.modelValue === 'true' || props.modelValue === '1'
})

function toggle() {
  if (props.readonly)
    return
  const next = isChecked.value ? 'false' : 'true'
  emit('update:modelValue', next)
  emit('commit', next)
}

function toggleDropdown() {
  if (props.readonly)
    return
  if (open.value) {
    closeDropdown()
  }
  else {
    openDropdown()
  }
}

function openDropdown() {
  open.value = true
  nextTick(() => {
    document.addEventListener('click', onClickOutside)
  })
}

function closeDropdown() {
  open.value = false
  document.removeEventListener('click', onClickOutside)
}

function onClickOutside(e: MouseEvent) {
  if (containerEl.value && !containerEl.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

function selectValue(val: 'true' | 'false') {
  if (props.readonly)
    return
  emit('update:modelValue', val)
  emit('commit', val)
  closeDropdown()
}
</script>
