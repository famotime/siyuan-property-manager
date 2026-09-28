<template>
  <div class="spm-doc-inline" :class="{ 'spm-doc-inline--expanded': expanded }">
    <button
      class="spm-doc-inline__toggle"
      type="button"
      :aria-expanded="expanded ? 'true' : 'false'"
      :title="expanded ? t('docInlineAttrsCollapse') : t('docInlineAttrsExpand')"
      @click="onToggleClick"
    >
      <span class="spm-doc-inline__chevron" :class="{ 'is-open': expanded }">
        <svg class="spm-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </span>
      <span class="spm-doc-inline__label">{{ isMobile ? `${t('mobileInlineBadge')} (${attrCount})` : t('docInlineAttrsTitle') }}</span>
      <span v-if="!isMobile && attrCount > 0" class="spm-doc-inline__count">{{ attrCount }}</span>
    </button>

    <div v-show="expanded && !isMobile" class="spm-doc-inline__panel">
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
            @rename="onRename"
          />
          <AddCustomRow :on-add="onAdd" />
        </AttrSection>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import AddCustomRow from './AddCustomRow.vue'
import AttrRow from './AttrRow.vue'
import AttrSection from './AttrSection.vue'
import { useAttrPanel } from '@/composables/useAttrPanel'
import { openMobileDrawer } from '@/mobileSheet'
import { getDocInlineAttrsInitialExpanded } from '@/utils/docInlineAttrs'

const props = defineProps<{
  docId: string
}>()

const plugin = inject<Plugin>('plugin')
if (!plugin)
  throw new Error('[siyuan-property-manager] plugin instance not provided')

const isMobile = computed(() => Boolean((plugin as any)?.isMobile))
const expanded = ref(getDocInlineAttrsInitialExpanded())
const docIdRef = computed<BlockId | null>(() => props.docId)

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
  dispose,
} = useAttrPanel(plugin, docIdRef)

const attrCount = computed(() => internalAttrs.value.length + customAttrs.value.length)

function onToggleClick() {
  if (isMobile.value) {
    openMobileDrawer(plugin!)
  }
  else {
    expanded.value = !expanded.value
  }
}

onBeforeUnmount(() => {
  dispose()
})
</script>
