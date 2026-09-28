<template>
  <div class="spm-schema-mgr">
    <div class="spm-schema-mgr__header">
      <div class="spm-schema-mgr__add">
        <input
          v-model="newKey"
          class="b3-text-field"
          type="text"
          :placeholder="t('keyPlaceholder')"
          @keydown.enter="addNewSchema"
        />
        <select v-model="newType" class="b3-select">
          <option v-for="item in ATTR_TYPE_METAS" :key="item.type" :value="item.type">
            {{ t(item.labelKey) }}
          </option>
        </select>
        <button
          class="b3-button b3-button--outline"
          type="button"
          :disabled="!canAdd"
          @click="addNewSchema"
        >
          {{ t('addProperty') }}
        </button>
      </div>

      <div class="spm-schema-mgr__toolbar">
        <span class="spm-schema-mgr__count">{{ t('totalAttrs') }}: {{ schemaList.length }}</span>
        <button
          class="b3-button b3-button--cancel spm-schema-mgr__reset-btn"
          type="button"
          :title="t('resetDefaultsDesc')"
          @click="onResetDefaults"
        >
          <svg class="spm-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; margin-right: 4px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          {{ t('resetDefaults') }}
        </button>
      </div>
    </div>

    <div class="spm-schema-mgr__list">
      <div v-if="schemaList.length === 0" class="spm-schema-mgr__empty">
        {{ t('templatesEmpty') }}
      </div>
      <div
        v-for="item in schemaList"
        :key="item.name"
        class="spm-schema-mgr__item"
      >
        <div class="spm-schema-mgr__row">
          <div class="spm-schema-mgr__name">
            <template v-if="editingKey === item.name">
              <input
                ref="renameInputEl"
                v-model="renameDraft"
                class="b3-text-field spm-schema-mgr__rename-input"
                type="text"
                @blur="commitRename(item.name)"
                @keydown.enter.prevent="commitRename(item.name)"
                @keydown.esc.prevent="cancelRename"
              />
            </template>
            <template v-else>
              <code>{{ item.name }}</code>
              <span v-if="item.label" class="spm-schema-mgr__item-label">({{ item.label }})</span>
              <button
                class="spm-schema-mgr__icon-btn"
                type="button"
                :title="t('renameAttr')"
                @click="startRename(item.name)"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </template>
          </div>
          <div class="spm-schema-mgr__type">
            <select
              :value="item.type"
              class="b3-select"
              @change="onTypeChange(item.name, ($event.target as HTMLSelectElement).value as AttrType)"
            >
              <option v-for="meta in ATTR_TYPE_METAS" :key="meta.type" :value="meta.type">
                {{ t(meta.labelKey) }}
              </option>
            </select>
          </div>
          <button
            class="spm-schema-mgr__delete"
            type="button"
            :title="t('deleteAttr')"
            @click="removeSchema(item.name)"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>

        <!-- 选项管理 (针对 select 和 multi-select) -->
        <div
          v-if="item.type === 'select' || item.type === 'multi-select'"
          class="spm-schema-mgr__options"
        >
          <div class="spm-schema-mgr__tags">
            <span
              v-for="opt in item.options || []"
              :key="opt.id || opt.value"
              class="spm-pill spm-pill--sm"
              :style="{ backgroundColor: opt.color ? `${opt.color}22` : undefined, color: opt.color || 'inherit' }"
            >
              <span class="spm-pill__dot" :style="{ backgroundColor: opt.color || 'currentColor' }" />
              <span class="spm-pill__text">{{ opt.label }}</span>
              <button
                class="spm-pill__remove"
                type="button"
                :title="t('removeTag')"
                @click="removeAttrOption(item.name, opt.id || opt.value)"
              >
                <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </span>
          </div>
          <div class="spm-schema-mgr__add-opt">
            <input
              v-model="optionInputs[item.name]"
              class="b3-text-field"
              type="text"
              :placeholder="t('searchOrAddOption')"
              @keydown.enter="addOptionToSchema(item.name)"
            />
            <button
              class="b3-button b3-button--text"
              type="button"
              @click="addOptionToSchema(item.name)"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { AttrType } from '@/types/schema'
import { computed, inject, nextTick, reactive, ref } from 'vue'
import { showMessage } from 'siyuan'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import { ATTR_TYPE_METAS } from '@/constants/schema'

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const {
  schemas,
  setAttrType,
  addAttrOption,
  removeAttrOption,
  removeSchema,
  renameSchema,
  resetToDefaults,
} = useAttrSchema()

const schemaList = computed(() => Object.values(schemas.value))

const newKey = ref('')
const newType = ref<AttrType>('select')
const optionInputs = reactive<Record<string, string>>({})

const editingKey = ref<string | null>(null)
const renameDraft = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

const canAdd = computed(() => {
  const k = newKey.value.trim()
  if (!k)
    return false
  const suffix = k.startsWith(CUSTOM_KEY_PREFIX) ? k.slice(CUSTOM_KEY_PREFIX.length) : k
  return isValidCustomSuffix(suffix)
})

function addNewSchema() {
  if (!canAdd.value)
    return
  const rawKey = newKey.value.trim()
  const fullKey = rawKey.startsWith(CUSTOM_KEY_PREFIX) ? rawKey : CUSTOM_KEY_PREFIX + rawKey
  setAttrType(fullKey, newType.value)
  newKey.value = ''
}

function onTypeChange(name: string, type: AttrType) {
  setAttrType(name, type)
}

function addOptionToSchema(name: string) {
  const val = optionInputs[name]?.trim()
  if (!val)
    return
  addAttrOption(name, { label: val, value: val })
  optionInputs[name] = ''
}

function startRename(name: string) {
  editingKey.value = name
  renameDraft.value = name.startsWith(CUSTOM_KEY_PREFIX) ? name.slice(CUSTOM_KEY_PREFIX.length) : name
  nextTick(() => {
    renameInputEl.value?.focus()
    renameInputEl.value?.select()
  })
}

function cancelRename() {
  editingKey.value = null
  renameDraft.value = ''
}

function commitRename(oldName: string) {
  if (editingKey.value !== oldName)
    return
  const trimmed = renameDraft.value.trim()
  if (!trimmed || !isValidCustomSuffix(trimmed)) {
    cancelRename()
    return
  }
  const newFullName = CUSTOM_KEY_PREFIX + trimmed
  if (newFullName !== oldName) {
    renameSchema(oldName, newFullName)
  }
  editingKey.value = null
  renameDraft.value = ''
}

async function onResetDefaults() {
  const ok = window.confirm(t('resetDefaultsConfirm'))
  if (!ok)
    return
  await resetToDefaults()
  showMessage(t('resetDefaultsSuccess'), 3000, 'info')
}
</script>
