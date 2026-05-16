<template>
  <div class="spm-dock">
    <header class="spm-dock__header">
      <div class="spm-dock__title">
        <svg class="spm-dock__icon"><use xlink:href="#iconPropertyManager" /></svg>
        <span>{{ t('dockTitle') }}</span>
      </div>
      <div v-if="currentBlockId && activeTab === 'edit'" class="spm-dock__id" :title="currentBlockId">
        <span class="spm-dock__kind" :class="`spm-dock__kind--${currentBlockKind}`">
          {{ currentBlockKind === 'doc' ? t('kindDoc') : t('kindBlock') }}
        </span>
        <code>{{ shortBlockId(currentBlockId) }}</code>
      </div>
    </header>

    <div v-if="!currentBlockId" class="spm-empty">
      <svg class="spm-empty__icon"><use xlink:href="#iconInfo" /></svg>
      <p>{{ t('selectBlockHint') }}</p>
    </div>

    <template v-else>
      <div class="spm-tabs">
        <button
          class="spm-tabs__item"
          :class="{ 'spm-tabs__item--active': activeTab === 'edit' }"
          @click="activeTab = 'edit'"
        >
          {{ t('tabEdit') }}
        </button>
        <button
          class="spm-tabs__item"
          :class="{ 'spm-tabs__item--active': activeTab === 'stats' }"
          @click="activeTab = 'stats'"
        >
          {{ t('tabStats') }}
        </button>
      </div>

      <template v-if="activeTab === 'edit'">
        <div v-if="loading && !hasData" class="spm-loading">{{ t('loading') }}</div>
        <div v-else-if="error" class="spm-error">{{ error }}</div>

        <div class="spm-dock__body">
          <AttrSection
            :title="t('internalAttrs')"
            :count="internalAttrs.length"
            storage-key="internal"
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
            storage-key="custom"
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
        </div>
      </template>

      <AttrStats
        v-else
        :root-id="currentRootId"
        :block-id="currentBlockId"
      />
    </template>
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
import AttrStats from './AttrStats.vue'
import { useBlockAttrs } from '@/composables/useBlockAttrs'
import { useCurrentBlock } from '@/composables/useCurrentBlock'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'
import { shortBlockId } from '@/utils/dom'

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
const activeTab = ref<'edit' | 'stats'>('edit')

const { currentBlockId, currentBlockKind, currentRootId, dispose } = useCurrentBlock(plugin)
const {
  loading,
  error,
  internalAttrs,
  customAttrs,
  saveAttr,
  deleteAttr,
  addCustom,
} = useBlockAttrs(currentBlockId)

const hasData = computed(() => internalAttrs.value.length + customAttrs.value.length > 0)

type RowExposed = { markSaving: () => void, markError: (msg: string) => void }
const rowRefs = new Map<string, RowExposed>()

function setRowRef(key: string, el: Element | ComponentPublicInstance | null) {
  if (!el) {
    rowRefs.delete(key)
    return
  }
  // Vue 3 把 <script setup> 组件实例通过 defineExpose 暴露的 API 直接挂在实例上
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

onBeforeUnmount(() => {
  dispose()
})
</script>
