<template>
  <div v-if="visible" class="spm-stats__value-blocks" :class="containerClass">
    <div v-if="cache === 'loading'" class="spm-stats__blocks-loading">
      {{ t('loading') }}
    </div>
    <div v-else-if="Array.isArray(cache)" class="spm-stats__blocks-list">
      <div
        v-for="blk in cache"
        :key="blk.id"
        class="spm-stats__value-block-item"
      >
        <div class="spm-stats__vblock-path" :title="blk.hpath">
          <svg class="spm-icon" viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>{{ blk.hpath }}</span>
        </div>
        <div class="spm-stats__vblock-meta">
          <code class="spm-stats__vblock-id" :title="blk.id">{{ shortBlockId(blk.id) }}</code>
          <span class="spm-stats__vblock-content" :title="blk.content">
            {{ blk.content ? (blk.content.slice(0, maxContent) + (blk.content.length > maxContent ? '...' : '')) : t('emptyValue') }}
          </span>
          <div class="spm-stats__vblock-actions">
            <button
              class="spm-stats__vblock-btn"
              type="button"
              :title="t('copyBlockId')"
              @click.stop="emit('copy', blk.id)"
            >
              <svg class="spm-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button
              class="spm-stats__vblock-btn"
              type="button"
              :title="t('jumpToBlock')"
              @click.stop="emit('jump', blk)"
            >
              <svg class="spm-icon" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
          </div>
        </div>
      </div>
      <div v-if="(cache as DrilldownBlock[]).length === 0" class="spm-stats__blocks-empty">
        {{ emptyText || t('noCustomBlocks') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject } from 'vue'
import { shortBlockId } from '@/utils/dom'

/** 下钻块条目的最小形状；`BlockInfoByAttr` / `BindingBlockInfo` 均可直接传入。 */
export interface DrilldownBlock {
  id: string
  hpath: string
  content: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  visible: boolean
  /** 懒加载缓存：`'loading'` | 块列表 | 未加载（undefined）。 */
  cache: DrilldownBlock[] | 'loading' | undefined
  /** 内容摘要截断长度（属性值下钻 5，数据库绑定块 10）。 */
  maxContent?: number
  /** 空态文案，默认「无自定义属性块」。 */
  emptyText?: string
  /** 附加容器类（如数据库卡片的 spm-db-stats__blocks-container）。 */
  containerClass?: string
}>(), {
  maxContent: 5,
})

const emit = defineEmits<{
  (e: 'copy', id: string): void
  (e: 'jump', block: DrilldownBlock): void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}
</script>
