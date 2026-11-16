<template>
  <section class="spm-section" :class="{ 'spm-section--collapsed': !open }">
    <header class="spm-section__header" :title="tooltip || title" @click="toggle">
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
import { computed, reactive, ref } from 'vue'

const props = defineProps<{
  title: string
  count?: number
  /** localStorage key 后缀，用于持久化折叠状态。 */
  storageKey?: string
  defaultOpen?: boolean
  /** 鼠标悬浮提示文案 */
  tooltip?: string
}>()

const storageKey = props.storageKey ? `spm.section.${props.storageKey}` : ''

// 折叠态跨实例共享（SM-122）：同 storageKey 的面板实例（Dock / 文档内联 /
// 移动端）在同一窗口内实时同步；localStorage 仅负责跨会话持久化。
const sharedOpen = reactive<Record<string, boolean>>({})

function readStoredOpen(key: string, fallback: boolean): boolean {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === null)
      return fallback
    return stored === '1'
  }
  catch {
    return fallback
  }
}

if (storageKey && sharedOpen[storageKey] === undefined)
  sharedOpen[storageKey] = readStoredOpen(storageKey, props.defaultOpen ?? true)

const localOpen = ref(props.defaultOpen ?? true)

const open = computed<boolean>({
  get: () => {
    if (!storageKey)
      return localOpen.value
    return sharedOpen[storageKey]
  },
  set: (next) => {
    if (!storageKey) {
      localOpen.value = next
      return
    }
    sharedOpen[storageKey] = next
    try {
      window.localStorage.setItem(storageKey, next ? '1' : '0')
    }
    catch {
      /* 忽略写入失败 */
    }
  },
})

function toggle() {
  open.value = !open.value
}
</script>
