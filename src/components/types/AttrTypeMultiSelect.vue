<template>
  <div ref="containerEl" class="spm-type-multi">
    <div
      class="spm-type-multi__wrapper"
      :class="{
        'spm-type-multi__wrapper--readonly': readonly,
        'spm-type-multi__wrapper--active': open,
      }"
      @click="toggleDropdown"
    >
      <div v-if="selectedTags.length > 0" class="spm-type-multi__tags">
        <span
          v-for="tag in selectedTags"
          :key="tag"
          class="spm-pill spm-pill--sm"
          :style="getTagStyle(tag)"
          @click.stop
        >
          <span class="spm-pill__text">{{ tag }}</span>
          <button
            v-if="!readonly"
            class="spm-pill__remove"
            type="button"
            :title="t('removeTag')"
            @click.stop="removeTag(tag)"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </span>
      </div>
      <span v-else class="spm-type-select__placeholder">{{ t('clickToAddTags') }}</span>
      <svg class="spm-icon spm-type-select__arrow" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>

    <!-- 下拉多选列表 -->
    <div v-if="open && !readonly" class="spm-dropdown">
      <div class="spm-dropdown__search">
        <input
          ref="searchInputEl"
          v-model="query"
          class="b3-text-field"
          type="text"
          :placeholder="t('searchOrAddTag')"
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
            'spm-dropdown__item--selected': isSelected(opt.value),
            'spm-dropdown__item--highlighted': idx === highlightIndex,
          }"
          @click="toggleTag(opt.value)"
        >
          <span
            class="spm-pill spm-pill--sm"
            :style="{ backgroundColor: opt.color ? `${opt.color}22` : undefined, color: opt.color || 'inherit' }"
          >
            <span class="spm-pill__dot" :style="{ backgroundColor: opt.color || 'currentColor' }" />
            {{ opt.label }}
          </span>
          <svg v-if="isSelected(opt.value)" class="spm-icon spm-dropdown__check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>

        <!-- 快速新建标签 -->
        <div
          v-if="canCreateTag"
          class="spm-dropdown__item spm-dropdown__item--create"
          :class="{ 'spm-dropdown__item--highlighted': highlightIndex === filteredOptions.length }"
          @click="createAndAddTag(query.trim())"
        >
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>{{ t('createTag') }} "<strong>{{ query.trim() }}</strong>"</span>
        </div>

        <div v-if="filteredOptions.length === 0 && !canCreateTag" class="spm-dropdown__empty">
          {{ t('noMatchingTags') }}
        </div>
      </div>

      <div v-if="selectedTags.length > 0" class="spm-dropdown__footer">
        <button class="spm-dropdown__clear-btn" type="button" @click="clearAllTags">
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          {{ t('clearAllTags') }}
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
import { parseMultiSelectValues, serializeMultiSelectValues } from '@/utils/typeInference'

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

const selectedTags = computed<string[]>(() => parseMultiSelectValues(props.modelValue))

function isSelected(val: string): boolean {
  return selectedTags.value.includes(val)
}

function getTagStyle(tag: string) {
  const opt = options.value.find(o => o.value === tag || o.label === tag)
  if (opt?.color) {
    return {
      backgroundColor: `${opt.color}22`,
      color: opt.color,
    }
  }
  return undefined
}

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q)
    return options.value
  return options.value.filter(o =>
    o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
  )
})

const canCreateTag = computed(() => {
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

function toggleTag(val: string) {
  const current = [...selectedTags.value]
  const idx = current.indexOf(val)
  if (idx !== -1) {
    current.splice(idx, 1)
  }
  else {
    current.push(val)
  }
  commitTags(current)
}

function removeTag(val: string) {
  const current = selectedTags.value.filter(t => t !== val)
  commitTags(current)
}

function createAndAddTag(val: string) {
  if (!val)
    return
  addAttrOption(props.attrKey, { label: val, value: val })
  const current = [...selectedTags.value]
  if (!current.includes(val)) {
    current.push(val)
    commitTags(current)
  }
  query.value = ''
}

function clearAllTags() {
  commitTags([])
  closeDropdown()
}

function commitTags(tags: string[]) {
  const serialized = serializeMultiSelectValues(tags)
  emit('update:modelValue', serialized)
  emit('commit', serialized)
}

function onNavDown() {
  const total = filteredOptions.value.length + (canCreateTag.value ? 1 : 0)
  if (total === 0)
    return
  highlightIndex.value = (highlightIndex.value + 1) % total
}

function onNavUp() {
  const total = filteredOptions.value.length + (canCreateTag.value ? 1 : 0)
  if (total === 0)
    return
  highlightIndex.value = (highlightIndex.value - 1 + total) % total
}

function onEnter() {
  if (highlightIndex.value < filteredOptions.value.length) {
    const opt = filteredOptions.value[highlightIndex.value]
    if (opt)
      toggleTag(opt.value)
  }
  else if (canCreateTag.value) {
    createAndAddTag(query.value.trim())
  }
}
</script>
