<template>
  <div v-if="open && normalizedItems.length > 0" class="spm-dropdown spm-autocomplete">
    <div class="spm-dropdown__list">
      <div
        v-for="(item, idx) in normalizedItems"
        :key="item.value"
        class="spm-dropdown__item spm-autocomplete__item"
        :class="{ 'spm-dropdown__item--highlighted': idx === highlightIndex }"
        @mousedown.prevent="onSelect(item.value)"
      >
        <span class="spm-autocomplete__text">{{ item.label ? `${item.value} (${item.label})` : item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export type AutocompleteItem = string | { value: string, label?: string }

const props = defineProps<{
  items: AutocompleteItem[]
  open: boolean
  highlightIndex: number
}>()

const emit = defineEmits<{
  (e: 'select', item: string): void
}>()

const normalizedItems = computed(() => {
  return props.items.map(item => {
    if (typeof item === 'string') {
      return { value: item, label: undefined }
    }
    return item
  })
})

function onSelect(value: string) {
  emit('select', value)
}
</script>
