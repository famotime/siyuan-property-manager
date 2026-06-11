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

          <AttrTemplates :on-apply="onApplyAttr" />
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
import { inject, onBeforeUnmount, ref } from 'vue'
import AddCustomRow from './AddCustomRow.vue'
import AttrRow from './AttrRow.vue'
import AttrSection from './AttrSection.vue'
import AttrStats from './AttrStats.vue'
import AttrTemplates from './AttrTemplates.vue'
import { useAttrPanel } from '@/composables/useAttrPanel'
import { useCurrentBlock } from '@/composables/useCurrentBlock'
import { shortBlockId } from '@/utils/dom'

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

const activeTab = ref<'edit' | 'stats'>('edit')

const { currentBlockId, currentBlockKind, currentRootId, dispose: disposeBlock } = useCurrentBlock(plugin)
const {
  loading,
  error,
  internalAttrs,
  customAttrs,
  hasData,
  prefix,
  t,
  attrLabel,
  setRowRef,
  onSave,
  onDelete,
  onAdd,
  onApplyAttr,
  dispose: disposePanel,
} = useAttrPanel(plugin, currentBlockId)

onBeforeUnmount(() => {
  disposePanel()
  disposeBlock()
})
</script>
