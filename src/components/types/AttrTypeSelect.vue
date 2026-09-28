<template>
  <div ref="containerEl" class="spm-type-select">
    <div
      class="spm-row__display spm-type-select__trigger"
      :class="{
        'spm-row__display--empty': !modelValue,
        'spm-row__display--readonly': readonly,
        'spm-type-select__trigger--active': open,
      }"
      :title="readonly ? modelValue : (modelValue || t('clickToSelect'))"
      @click="toggleDropdown"
    >
      <span
        v-if="currentOption"
        class="spm-pill"
        :style="{ backgroundColor: currentOption.color ? `${currentOption.color}22` : undefined, color: currentOption.color || 'var(--b3-theme-primary)' }"
      >
        <span class="spm-pill__dot" :style="{ backgroundColor: currentOption.color || 'var(--b3-theme-primary)' }" />
        <span class="spm-pill__text">{{ currentOption.label }}</span>
      </span>
      <span
        v-else-if="modelValue"
        class="spm-pill"
      >
        <span class="spm-pill__text">{{ modelValue }}</span>
      </span>
      <span v-else class="spm-type-select__placeholder">{{ t('clickToSelect') }}</span>
      <svg class="spm-icon spm-type-select__arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>

    <!-- 下拉弹层 -->
    <div v-if="open && !readonly" class="spm-dropdown">
      <div class="spm-dropdown__search">
        <input
          ref="searchInputEl"
          v-model="query"
          class="b3-text-field"
          type="text"
          :placeholder="t('searchOrAddOption')"
          @keydown.down.prevent="onNavDown"
          @keydown.up.prevent="onNavUp"
          @keydown.enter.prevent="onEnter"
          @keydown.esc.prevent="closeDropdown"
        />
      </div>

      <div class="spm-dropdown__list">
        <div
          v-for="(opt, idx) in filteredOptions"
          :key="opt.id || opt.value"
          class="spm-dropdown__item"
          :class="{
            'spm-dropdown__item--selected': opt.value === modelValue,
            'spm-dropdown__item--highlighted': idx === highlightIndex,
          }"
          @click="selectOption(opt)"
        >
          <span
            class="spm-pill spm-pill--sm"
            :style="{ backgroundColor: opt.color ? `${opt.color}22` : undefined, color: opt.color || 'inherit' }"
          >
            <span class="spm-pill__dot" :style="{ backgroundColor: opt.color || 'currentColor' }" />
            {{ opt.label }}
          </span>
          <svg v-if="opt.value === modelValue" class="spm-icon spm-dropdown__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>

        <!-- 快速新建选项 -->
        <div
          v-if="canCreateOption"
          class="spm-dropdown__item spm-dropdown__item--create"
          :class="{ 'spm-dropdown__item--highlighted': highlightIndex === filteredOptions.length }"
          @click="createAndSelect(query.trim())"
        >
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>{{ t('createOption') }} "<strong>{{ query.trim() }}</strong>"</span>
        </div>

        <div v-if="filteredOptions.length === 0 && !canCreateOption" class="spm-dropdown__empty">
          {{ t('noMatchingOptions') }}
        </div>
      </div>

      <div v-if="modelValue" class="spm-dropdown__footer">
        <button class="spm-dropdown__clear-btn" type="button" @click="clearValue">
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          {{ t('clearSelection') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { AttrOption } from '@/types/schema'
import { computed, inject, nextTick, onBeforeUnmount, ref } from 'vue'
import { useAttrSchema } from '@/composables/useAttrSchema'

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

const { getSchema, addAttrOption } = useAttrSchema()

const containerEl = ref<HTMLElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')
const highlightIndex = ref(0)

const schema = computed(() => getSchema(props.attrKey))
const options = computed<AttrOption[]>(() => schema.value?.options ?? [])

const currentOption = computed(() => {
  return options.value.find(o => o.value === props.modelValue)
})

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return options.value
  return options.value.filter(o =>
    o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
  )
})

const canCreateOption = computed(() => {
  const q = query.value.trim()
  if (!q)
    return false
  return !options.value.some(o => o.value.toLowerCase() === q.toLowerCase() || o.label.toLowerCase() === q.toLowerCase())
})

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
  query.value = ''
  highlightIndex.value = 0
  nextTick(() => {
    searchInputEl.value?.focus()
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

function selectOption(opt: AttrOption) {
  emit('update:modelValue', opt.value)
  emit('commit', opt.value)
  closeDropdown()
}

function createAndSelect(val: string) {
  if (!val)
    return
  const created = addAttrOption(props.attrKey, { label: val, value: val })
  selectOption(created)
}

function clearValue() {
  emit('update:modelValue', '')
  emit('commit', '')
  closeDropdown()
}

function onNavDown() {
  const total = filteredOptions.value.length + (canCreateOption.value ? 1 : 0)
  if (total === 0)
    return
  highlightIndex.value = (highlightIndex.value + 1) % total
}

function onNavUp() {
  const total = filteredOptions.value.length + (canCreateOption.value ? 1 : 0)
  if (total === 0)
    return
  highlightIndex.value = (highlightIndex.value - 1 + total) % total
}

function onEnter() {
  if (highlightIndex.value < filteredOptions.value.length) {
    const opt = filteredOptions.value[highlightIndex.value]
    if (opt)
      selectOption(opt)
  }
  else if (canCreateOption.value) {
    createAndSelect(query.value.trim())
  }
}
</script>
