<template>
  <div class="spm-dock">
    <header class="spm-dock__header">
      <div class="spm-dock__title">
        <svg class="spm-dock__icon"><use xlink:href="#iconPropertyManager" /></svg>
        <span>{{ t('dockTitle') }}</span>
      </div>
      <div class="spm-dock__actions">
        <div v-if="currentBlockId && activeTab === 'edit'" class="spm-dock__id" :title="currentBlockId">
          <span class="spm-dock__kind" :class="`spm-dock__kind--${currentBlockKind}`">
            {{ currentBlockKind === 'doc' ? t('kindDoc') : t('kindBlock') }}
          </span>
          <code>{{ shortBlockId(currentBlockId) }}</code>
        </div>
        <button
          class="spm-dock__action-btn"
          type="button"
          :title="t('settingSchemaTitle')"
          :aria-label="t('settingSchemaTitle')"
          @click="onOpenSchemaManager"
        >
          <svg class="spm-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </button>
      </div>
    </header>

    <div v-if="!currentBlockId" class="spm-empty">
      <svg class="spm-icon spm-empty__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      <h3>{{ t('noBlockSelected') }}</h3>
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
            <template #header-actions>
              <button
                v-if="customAttrs.length"
                class="spm-section__action-btn"
                type="button"
                :title="t('convertToTemplate')"
                @click="onConvertToTemplate"
              >
                <svg class="spm-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
              </button>
            </template>
            <AttrRow
              v-for="row in customAttrs"
              :key="row.key"
              :ref="(el) => setRowRef(row.key, el)"
              :row="row"
              :label="row.key.slice(prefix.length)"
              deletable
              @save="onSave"
              @delete="onDelete"
              @rename="onRename"
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
        @jump-to-edit="activeTab = 'edit'"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import AddCustomRow from './AddCustomRow.vue'
import AttrRow from './AttrRow.vue'
import AttrSection from './AttrSection.vue'
import AttrStats from './AttrStats.vue'
import AttrTemplates from './AttrTemplates.vue'
import { useAttrPanel } from '@/composables/useAttrPanel'
import { useCurrentBlock } from '@/composables/useCurrentBlock'
import { useTemplates } from '@/composables/useTemplates'
import { openSchemaManagerDialog } from '@/main'
import { shortBlockId } from '@/utils/dom'

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

function onOpenSchemaManager() {
  if (typeof (plugin as any)?.openSchemaManager === 'function') {
    (plugin as any).openSchemaManager()
  }
  else {
    openSchemaManagerDialog(plugin)
  }
}

const activeTab = ref<'edit' | 'stats'>('edit')

const { currentBlockId, currentBlockKind, currentRootId, initCurrentBlock, dispose: disposeBlock } = useCurrentBlock(plugin)
onMounted(() => {
  if (!currentBlockId.value) {
    initCurrentBlock()
  }
})
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
  onRename,
  onAdd,
  onApplyAttr,
  dispose: disposePanel,
} = useAttrPanel(plugin, currentBlockId)

const { createFromAttrs } = useTemplates()

function getBlockContent(): string {
  const id = currentBlockId.value
  if (!id)
    return ''
  // 优先从 DOM 获取块文本
  const el = document.querySelector(`[data-node-id="${id}"]`)
  const text = el?.textContent?.trim()
  if (text)
    return text.length > 50 ? `${text.slice(0, 50)}…` : text
  // 文档块回退到内部属性
  const nameAttr = internalAttrs.value.find(a => a.key === 'name' && a.value)
  if (nameAttr)
    return nameAttr.value
  const titleAttr = internalAttrs.value.find(a => a.key === 'title' && a.value)
  if (titleAttr)
    return titleAttr.value
  return ''
}

function onConvertToTemplate() {
  const attrs = customAttrs.value.map(a => ({
    key: a.key.slice(prefix.length),
    value: a.value,
  }))
  const name = getBlockContent() || t('templateDefaultName')
  createFromAttrs(name, attrs)
}

onBeforeUnmount(() => {
  disposePanel()
  disposeBlock()
})
</script>
