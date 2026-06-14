<template>
  <section class="spm-section" :class="{ 'spm-section--collapsed': !open }">
    <header class="spm-section__header" @click="toggle">
      <span class="spm-section__chevron" :class="{ 'is-open': open }">
        <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </span>
      <span class="spm-section__title">{{ title }}</span>
      <span v-if="typeof count === 'number'" class="spm-section__count">{{ count }}</span>
      <span v-if="$slots['header-actions']" class="spm-section__actions" @click.stop>
        <slot name="header-actions" />
      </span>
    </header>
    <div v-show="open" class="spm-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  title: string
  count?: number
  /** localStorage key 后缀，用于持久化折叠状态。 */
  storageKey?: string
  defaultOpen?: boolean
}>()

const storageKey = props.storageKey ? `spm.section.${props.storageKey}` : ''
const initial = (() => {
  if (!storageKey)
    return props.defaultOpen ?? true
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === null)
      return props.defaultOpen ?? true
    return stored === '1'
  }
  catch {
    return props.defaultOpen ?? true
  }
})()
const open = ref(initial)

function toggle() {
  open.value = !open.value
}

watch(open, (value) => {
  if (!storageKey)
    return
  try {
    window.localStorage.setItem(storageKey, value ? '1' : '0')
  }
  catch {
    /* 忽略写入失败 */
  }
})
</script>
