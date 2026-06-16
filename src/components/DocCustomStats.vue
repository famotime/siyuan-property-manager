<template>
  <AttrSection
    :title="t('docCustomBlocks')"
    :count="loading ? undefined : blocks.length"
    storage-key="stats-doc"
    :default-open="true"
  >
    <div v-if="loading" class="spm-stats__empty">{{ t('loading') }}</div>
    <div v-else-if="blocks.length === 0" class="spm-stats__empty">{{ t('noCustomBlocks') }}</div>
    <div v-else class="spm-stats__block-list">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="spm-stats__block-item"
        :title="t('clickToJump')"
        @click="jumpToBlock(block)"
      >
        <div class="spm-stats__block-head">
          <span class="spm-stats__block-type">{{ block.type }}</span>
          <code class="spm-stats__block-id">{{ shortBlockId(block.id) }}</code>
          <button
            class="spm-stats__jump-edit-btn"
            type="button"
            :title="t('jumpAndEdit')"
            @click.stop="jumpAndEdit(block)"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>
        </div>
        <div class="spm-stats__block-content">{{ block.content || t('emptyValue') }}</div>
        <div class="spm-stats__block-attrs">
          <span
            v-for="attr in block.attrs"
            :key="attr.key"
            class="spm-stats__attr-tag"
          >
            {{ attr.key.slice(prefixLen) }}={{ attr.value || '·' }}
          </span>
        </div>
      </div>
    </div>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject } from 'vue'
import { useDocCustomBlocks } from '@/composables/useDocCustomStats'
import type { DocBlockWithAttrs } from '@/composables/useSharedStats'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { shortBlockId } from '@/utils/dom'
import AttrSection from './AttrSection.vue'

const props = defineProps<{
  rootId: string | null
  blockId: string | null
}>()

const emit = defineEmits<{
  (e: 'jump-to-edit'): void
  (e: 'jump-to-block', block: DocBlockWithAttrs): void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const prefixLen = CUSTOM_KEY_PREFIX.length

const rootIdRef = computed(() => props.rootId)
const blockIdRef = computed(() => props.blockId)

const { blocks, loading } = useDocCustomBlocks(rootIdRef, blockIdRef)

function jumpToBlock(block: DocBlockWithAttrs) {
  emit('jump-to-block', block)
}

function jumpAndEdit(block: DocBlockWithAttrs) {
  emit('jump-to-block', block)
  emit('jump-to-edit')
}
</script>
