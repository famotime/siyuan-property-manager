<template>
  <div ref="containerEl" class="spm-type-blockref">
    <div
      class="spm-row__display spm-type-blockref__trigger"
      :class="{
        'spm-row__display--empty': !modelValue,
        'spm-row__display--readonly': readonly,
        'spm-type-blockref__trigger--active': open,
      }"
    >
      <!-- 有关联值时：超链接 + 右侧动作按钮 -->
      <template v-if="modelValue">
        <a
          class="spm-type-blockref__link"
          :title="tooltipText"
          @click.stop="onJump"
        >
          <svg v-if="blockType === 'd'" class="spm-icon spm-type-blockref__icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <svg v-else class="spm-icon spm-type-blockref__icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span class="spm-type-blockref__text">{{ blockTitle || shortBlockId(modelValue) }}</span>
        </a>

        <!-- 操作区：更换关联与清除 -->
        <div v-if="!readonly" class="spm-type-blockref__actions">
          <button
            class="spm-type-blockref__action-btn"
            type="button"
            :title="t('changeRelation')"
            @click.stop="openSearch"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button
            class="spm-type-blockref__action-btn spm-type-blockref__action-btn--clear"
            type="button"
            :title="t('clearBlockRef')"
            @click.stop="clearRef"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </template>

      <!-- 无关联值时：点击关联块占位符 -->
      <span
        v-else
        class="spm-type-blockref__placeholder"
        @click="openSearch"
      >
        <svg class="spm-icon spm-type-blockref__icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
        {{ t('clickToLinkBlock') }}
      </span>
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
          @click="selectBlock(item)"
        >
          <svg v-if="item.type === 'd'" class="spm-type-blockref__result-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <svg v-else class="spm-type-blockref__result-icon" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <div class="spm-type-blockref__result-main">
            <div class="spm-type-blockref__result-content">{{ item.content || item.name || item.id }}</div>
            <div class="spm-type-blockref__result-meta">
              <span v-if="item.hPath" class="spm-type-blockref__result-path">{{ item.hPath }}</span>
              <span class="spm-type-blockref__result-type">{{ item.type === 'd' ? (t('docType') || '文档') : item.type }}</span>
            </div>
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
import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { openTab } from 'siyuan'
import { getBlockRefInfo, searchBlocksByKeyword } from '@/api'
import type { BlockRefCandidate } from '@/api'
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
const searchResults = ref<BlockRefCandidate[]>([])
const highlightIndex = ref(0)
const blockTitle = ref('')
const blockType = ref('p')
const blockPath = ref('')

const tooltipText = computed(() => {
  if (props.readonly)
    return props.modelValue
  if (!props.modelValue)
    return t('clickToLinkBlock')
  const typeDesc = blockType.value === 'd' ? (t('docType') || '文档') : (t('blockRefType') || '块关联')
  const pathDesc = blockPath.value ? `\n${t('path') || '路径'}: ${blockPath.value}` : ''
  return `[${typeDesc}] ${blockTitle.value || props.modelValue}${pathDesc}\nID: ${props.modelValue}\n${t('clickToJump') || '点击打开文档并跳转'}`
})

async function fetchBlockSummary(id: string) {
  if (!id) {
    blockTitle.value = ''
    blockType.value = 'p'
    blockPath.value = ''
    return
  }
  // 1. 尝试从当前打开的 DOM 中快速获取
  const el = document.querySelector(`[data-node-id="${id}"]`)
  if (el) {
    const isDoc = el.classList.contains('protyle-wysiwyg') || el.classList.contains('protyle-title')
    const txt = el.textContent?.trim()
    if (txt) {
      blockTitle.value = txt.length > 50 ? `${txt.slice(0, 50)}…` : txt
      blockType.value = isDoc ? 'd' : (el.getAttribute('data-type') || 'p')
      return
    }
  }
  // 2. 从数据库接口获取完整信息
  try {
    const info = await getBlockRefInfo(id)
    if (info) {
      const rawText = info.type === 'd' ? (info.content || info.name || '') : (info.content || info.name || '')
      blockTitle.value = rawText.length > 50 ? `${rawText.slice(0, 50)}…` : rawText
      blockType.value = info.type || 'p'
      blockPath.value = info.hPath || ''
    }
    else {
      blockTitle.value = ''
      blockType.value = 'p'
      blockPath.value = ''
    }
  }
  catch {
    blockTitle.value = ''
    blockType.value = 'p'
    blockPath.value = ''
  }
}

watch(() => props.modelValue, (next) => {
  void fetchBlockSummary(next)
}, { immediate: true })

function openSearch() {
  if (props.readonly)
    return
  open.value = true
  query.value = ''
  searchResults.value = []
  highlightIndex.value = 0
  nextTick(() => {
    searchInputEl.value?.focus()
    document.addEventListener('click', onClickOutside)
    void executeSearch('')
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
  searchDebounceTimer = setTimeout(() => {
    void executeSearch(query.value)
  }, 200)
}

async function executeSearch(q: string) {
  searching.value = true
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
}

function selectBlock(item: BlockRefCandidate) {
  const content = item.type === 'd' ? (item.content || item.name || '') : (item.content || item.name || '')
  blockTitle.value = content.length > 50 ? `${content.slice(0, 50)}…` : content
  blockType.value = item.type
  blockPath.value = item.hPath || ''
  emit('update:modelValue', item.id)
  emit('commit', item.id)
  closeSearch()
}

function clearRef() {
  blockTitle.value = ''
  blockType.value = 'p'
  blockPath.value = ''
  emit('update:modelValue', '')
  emit('commit', '')
  closeSearch()
}

function onJump() {
  const id = props.modelValue
  if (!id)
    return

  highlightBlock(id)

  if (plugin?.app) {
    try {
      openTab({
        app: plugin.app,
        doc: {
          id,
          action: ['cb-get-focus', 'cb-get-scroll', 'cb-get-context'],
        },
      })
      return
    }
    catch {
      // 降级使用传统滚动与定位
    }
  }

  // 兜底降级处理：尝试滚动当前打开文档中的对应块
  const docEl = document.querySelector('.protyle[data-doc-id] .protyle-wysiwyg')
  const rootId = (docEl?.closest('.protyle') as HTMLElement)?.dataset.docId
  if (rootId && scrollOpenedDocToBlock(rootId, id)) {
    highlightBlock(id)
  }
  else {
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
    selectBlock(searchResults.value[highlightIndex.value])
  }
}
</script>
