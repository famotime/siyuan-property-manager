<template>
  <div class="spm-type-checkbox">
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
    <span class="spm-type-checkbox__label" @click="toggle">
      {{ isChecked ? t('checkedTrue') : t('checkedFalse') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject } from 'vue'

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
</script>
