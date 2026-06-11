<template>
  <div class="spm-doc-inline" :class="{ 'spm-doc-inline--expanded': expanded }">
    <button
      class="spm-doc-inline__toggle"
      type="button"
      :aria-expanded="expanded ? 'true' : 'false'"
      :title="expanded ? t('docInlineAttrsCollapse') : t('docInlineAttrsExpand')"
      @click="expanded = !expanded"
    >
      <span class="spm-doc-inline__chevron" :class="{ 'is-open': expanded }">▸</span>
      <span class="spm-doc-inline__label">{{ t('docInlineAttrsTitle') }}</span>
      <span v-if="attrCount > 0" class="spm-doc-inline__count">{{ attrCount }}</span>
    </button>

    <div v-show="expanded" class="spm-doc-inline__panel">
      <div v-if="loading && !hasData" class="spm-loading spm-doc-inline__message">{{ t('loading') }}</div>
      <div v-else-if="error" class="spm-error spm-doc-inline__message">{{ error }}</div>

      <template v-else>
        <AttrSection
          :title="t('internalAttrs')"
          :count="internalAttrs.length"
          :default-open="true"
        >
          <AttrRow
            v-for="row in internalAttrs"
            :key="row.key"
            :ref="(el) => setRowRef(row.key, el)"
            :row="row"
            :label="row.readonly ? undefined : attrLabel(row.key)"
            @save="onSave"
          />
        </AttrSection>

        <AttrSection
          :title="t('customAttrs')"
          :count="customAttrs.length"
          :default-open="true"
        >
          <AttrRow
            v-for="row in customAttrs"
            :key="row.key"
            :ref="(el) => setRowRef(row.key, el)"
            :row="row"
            :label="row.key.slice(prefix.length)"
            deletable
            @save="onSave"
            @delete="onDelete"
          />
          <AddCustomRow :on-add="onAdd" />
        </AttrSection>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { ComponentPublicInstance } from 'vue'
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { showMessage } from 'siyuan'
import AddCustomRow from './AddCustomRow.vue'
import AttrRow from './AttrRow.vue'
import AttrSection from './AttrSection.vue'
import { useBlockAttrs } from '@/composables/useBlockAttrs'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { getDocInlineAttrsInitialExpanded } from '@/utils/docInlineAttrs'

const props = defineProps<{
  docId: string
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function t(key: string): string {
  return (plugin!.i18n?.[key] as string | undefined) ?? key
}

function attrLabel(key: string): string {
  return (plugin!.i18n?.[`attr_${key}`] as string | undefined) ?? key
}

const prefix = CUSTOM_KEY_PREFIX
const expanded = ref(getDocInlineAttrsInitialExpanded())
const docIdRef = computed<BlockId | null>(() => props.docId)

const {
  loading,
  error,
  internalAttrs,
  customAttrs,
  saveAttr,
  deleteAttr,
  addCustom,
  reload,
} = useBlockAttrs(docIdRef)

// 监听其他实例（如 Dock 面板）对同一块的属性修改，同步刷新。
function onAttrsChanged(e: Event) {
  const changedId = (e as CustomEvent).detail?.blockId as string | undefined
  if (changedId && changedId === props.docId)
    reload()
}
document.addEventListener('spm:attrs-changed', onAttrsChanged)
onBeforeUnmount(() => {
  document.removeEventListener('spm:attrs-changed', onAttrsChanged)
})

const hasData = computed(() => internalAttrs.value.length + customAttrs.value.length > 0)
const attrCount = computed(() => internalAttrs.value.length + customAttrs.value.length)

type RowExposed = { markSaving: () => void, markError: (msg: string) => void }
const rowRefs = new Map<string, RowExposed>()

function setRowRef(key: string, el: Element | ComponentPublicInstance | null) {
  if (!el) {
    rowRefs.delete(key)
    return
  }
  rowRefs.set(key, el as unknown as RowExposed)
}

async function onSave(key: string, value: string) {
  const row = rowRefs.get(key)
  row?.markSaving()
  try {
    await saveAttr(key, value)
  }
  catch (err: any) {
    const msg = err?.message ?? t('saveError')
    row?.markError(msg)
    showMessage(`${t('saveError')}: ${msg}`, 5000, 'error')
  }
}

async function onDelete(key: string) {
  try {
    await deleteAttr(key)
  }
  catch (err: any) {
    const msg = err?.message ?? t('saveError')
    showMessage(`${t('saveError')}: ${msg}`, 5000, 'error')
  }
}

async function onAdd(suffix: string, value: string) {
  await addCustom(suffix, value)
}
</script>
