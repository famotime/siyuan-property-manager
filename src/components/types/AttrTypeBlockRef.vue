<template>
  <div ref="containerEl" class="spm-type-blockref">
    <div
      class="spm-row__display spm-type-blockref__trigger"
      :class="{
        'spm-row__display--empty': !modelValue,
        'spm-row__display--readonly': readonly,
        'spm-type-blockref__trigger--active': open,
      }"
      :title="readonly ? modelValue : (modelValue ? `${blockText || modelValue} (${modelValue})` : t('clickToLinkBlock'))"
      @click="toggleSearch"
    >
      <svg class="spm-icon spm-type-blockref__icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      <span v-if="modelValue" class="spm-type-blockref__badge">
        <span class="spm-type-blockref__text">{{ blockText || shortBlockId(modelValue) }}</span>
      </span>
      <span v-else class="spm-type-blockref__placeholder">{{ t('clickToLinkBlock') }}</span>

      <!-- 跳转到目标块按钮 -->
      <button
        v-if="modelValue"
        class="spm-type-blockref__jump-btn"
        type="button"
        :title="t('jumpToBlock')"
        @click.stop="onJump"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
    </div>

    <!-- 块搜索浮层 -->
    <div v-if="open && !readonly" class="spm-dropdown spm-type-blockref__dropdown">
      <div class="spm-dropdown__search">
        <input
          ref="searchInputEl"
          v-model="query"
          class="b3-text-field"
          type="text"
          :placeholder="t('searchBlockKeyword')"
          @input="onSearchInput"
          @keydown.down.prevent="onNavDown"
          @keydown.up.prevent="onNavUp"
          @keydown.enter.prevent="onEnter"
          @keydown.esc.prevent="closeSearch"
        />
      </div>

      <div class="spm-dropdown__list">
        <div v-if="searching" class="spm-dropdown__loading">
          {{ t('searching') }}
        </div>
        <div
          v-for="(item, idx) in searchResults"
          v-else
          :key="item.id"
          class="spm-dropdown__item spm-type-blockref__result"
          :class="{
            'spm-dropdown__item--selected': item.id === modelValue,
            'spm-dropdown__item--highlighted': idx === highlightIndex,
          }"
          @click="selectBlock(item.id, item.content)"
        >
          <div class="spm-type-blockref__result-content">{{ item.content || item.id }}</div>
          <div class="spm-type-blockref__result-meta">
            <code>{{ shortBlockId(item.id) }}</code>
            <span class="spm-type-blockref__result-type">{{ item.type }}</span>
          </div>
        </div>

        <div v-if="!searching && searchResults.length === 0 && query.trim()" class="spm-dropdown__empty">
          {{ t('noMatchingBlocks') }}
        </div>
        <div v-if="!query.trim() && searchResults.length === 0" class="spm-dropdown__empty">
          {{ t('typeToSearchBlocks') }}
        </div>
      </div>

      <div v-if="modelValue" class="spm-dropdown__footer">
        <button class="spm-dropdown__clear-btn" type="button" @click="clearRef">
          <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          {{ t('clearBlockRef') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getBlockContent, searchBlocksByKeyword } from '@/api'
import { highlightBlock, scrollOpenedDocToBlock } from '@/utils/blockJump'
import { shortBlockId } from '@/utils/dom'

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

const containerEl = ref<HTMLElement | null>(null)
const searchInputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)
const query = ref('')
const searching = ref(false)
const searchResults = ref<Array<{ id: string, content: string, type: string }>>([])
const highlightIndex = ref(0)
const blockText = ref('')

async function fetchBlockSummary(id: string) {
  if (!id) {
    blockText.value = ''
    return
  }
  // 优先从 DOM 查询
  const el = document.querySelector(`[data-node-id="${id}"]`)
  const txt = el?.textContent?.trim()
  if (txt) {
    blockText.value = txt.length > 40 ? `${txt.slice(0, 40)}…` : txt
    return
  }
  // 从 SQL 查询
  try {
    const content = await getBlockContent(id)
    if (content) {
      blockText.value = content.length > 40 ? `${content.slice(0, 40)}…` : content
    }
  }
  catch {
    blockText.value = ''
  }
}

watch(() => props.modelValue, (next) => {
  void fetchBlockSummary(next)
}, { immediate: true })

function toggleSearch() {
  if (props.readonly)
    return
  if (open.value) {
    closeSearch()
  }
  else {
    openSearch()
  }
}

function openSearch() {
  open.value = true
  query.value = ''
  searchResults.value = []
  highlightIndex.value = 0
  nextTick(() => {
    searchInputEl.value?.focus()
    document.addEventListener('click', onClickOutside)
  })
}

function closeSearch() {
  open.value = false
  document.removeEventListener('click', onClickOutside)
}

function onClickOutside(e: MouseEvent) {
  if (containerEl.value && !containerEl.value.contains(e.target as Node)) {
    closeSearch()
  }
}

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchDebounceTimer)
    clearTimeout(searchDebounceTimer)
  const q = query.value.trim()
  if (!q) {
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  searchDebounceTimer = setTimeout(async () => {
    try {
      const results = await searchBlocksByKeyword(q, 15)
      searchResults.value = results
      highlightIndex.value = 0
    }
    catch {
      searchResults.value = []
    }
    finally {
      searching.value = false
    }
  }, 250)
}

function selectBlock(id: string, content?: string) {
  blockText.value = content ? (content.length > 40 ? `${content.slice(0, 40)}…` : content) : ''
  emit('update:modelValue', id)
  emit('commit', id)
  closeSearch()
}

function clearRef() {
  blockText.value = ''
  emit('update:modelValue', '')
  emit('commit', '')
  closeSearch()
}

function onJump() {
  const id = props.modelValue
  if (!id)
    return
  // 查找当前根文档或在当前打开的文档尝试滚动
  const docEl = document.querySelector('.protyle[data-doc-id] .protyle-wysiwyg')
  const rootId = (docEl?.closest('.protyle') as HTMLElement)?.dataset.docId
  if (rootId && scrollOpenedDocToBlock(rootId, id)) {
    highlightBlock(id)
  }
  else {
    // 调用思源客户端跳转
    window.location.hash = `siyuan://blocks/${id}`
  }
}

function onNavDown() {
  if (searchResults.value.length === 0)
    return
  highlightIndex.value = (highlightIndex.value + 1) % searchResults.value.length
}

function onNavUp() {
  if (searchResults.value.length === 0)
    return
  highlightIndex.value = (highlightIndex.value - 1 + searchResults.value.length) % searchResults.value.length
}

function onEnter() {
  if (searchResults.value[highlightIndex.value]) {
    const item = searchResults.value[highlightIndex.value]
    selectBlock(item.id, item.content)
  }
}
</script>
