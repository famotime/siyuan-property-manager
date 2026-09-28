<template>
  <div ref="containerEl" class="spm-type-menu-wrapper">
    <button
      class="spm-type-menu-btn"
      type="button"
      :title="t('changeTypeHint')"
      @click.stop="toggleMenu"
    >
      <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24">
        <!-- text -->
        <template v-if="currentType === 'text'">
          <polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>
        </template>
        <!-- number -->
        <template v-else-if="currentType === 'number'">
          <line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line>
        </template>
        <!-- select -->
        <template v-else-if="currentType === 'select'">
          <circle cx="12" cy="12" r="10"></circle><polyline points="12 8 8 12 12 16"></polyline><line x1="16" y1="12" x2="8" y2="12"></line>
        </template>
        <!-- multi-select -->
        <template v-else-if="currentType === 'multi-select'">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>
        </template>
        <!-- date -->
        <template v-else-if="currentType === 'date'">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
        </template>
        <!-- checkbox -->
        <template v-else-if="currentType === 'checkbox'">
          <polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </template>
        <!-- block-ref -->
        <template v-else-if="currentType === 'block-ref'">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </template>
      </svg>
    </button>

    <div v-if="open" class="spm-dropdown spm-type-menu">
      <div class="spm-type-menu__header">{{ t('selectAttrType') }}</div>
      <div
        v-for="item in ATTR_TYPE_METAS"
        :key="item.type"
        class="spm-dropdown__item spm-type-menu__item"
        :class="{ 'spm-dropdown__item--selected': item.type === currentType }"
        @click.stop="onSelectType(item.type)"
      >
        <span class="spm-type-menu__item-label">{{ t(item.labelKey) }}</span>
        <svg v-if="item.type === currentType" class="spm-icon spm-dropdown__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { AttrType } from '@/types/schema'
import { inject, nextTick, onBeforeUnmount, ref } from 'vue'
import { ATTR_TYPE_METAS } from '@/constants/schema'

defineProps<{
  currentType: AttrType
  attrKey: string
}>()

const emit = defineEmits<{
  (e: 'change-type', type: AttrType): void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const containerEl = ref<HTMLElement | null>(null)
const open = ref(false)

function toggleMenu() {
  if (open.value) {
    closeMenu()
  }
  else {
    openMenu()
  }
}

function openMenu() {
  open.value = true
  nextTick(() => {
    document.addEventListener('click', onClickOutside)
  })
}

function closeMenu() {
  open.value = false
  document.removeEventListener('click', onClickOutside)
}

function onClickOutside(e: MouseEvent) {
  if (containerEl.value && !containerEl.value.contains(e.target as Node)) {
    closeMenu()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

function onSelectType(type: AttrType) {
  emit('change-type', type)
  closeMenu()
}
</script>
