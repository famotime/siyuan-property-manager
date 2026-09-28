<template>
  <div v-if="open && items.length > 0" class="spm-dropdown spm-autocomplete">
    <div class="spm-dropdown__list">
      <div
        v-for="(item, idx) in items"
        :key="item"
        class="spm-dropdown__item spm-autocomplete__item"
        :class="{ 'spm-dropdown__item--highlighted': idx === highlightIndex }"
        @mousedown.prevent="onSelect(item)"
      >
        <span class="spm-autocomplete__text">{{ item }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: string[]
  open: boolean
  highlightIndex: number
}>()

const emit = defineEmits<{
  (e: 'select', item: string): void
}>()

function onSelect(item: string) {
  emit('select', item)
}
</script>
