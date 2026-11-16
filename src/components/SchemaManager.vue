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
        <!-- 搜索输入框 -->
        <div class="spm-schema-mgr__search">
          <svg class="spm-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            v-model="searchQuery"
            class="b3-text-field spm-schema-mgr__search-input"
            type="text"
            :placeholder="t('searchAttrsPlaceholder')"
            spellcheck="false"
          />
          <button
            v-if="searchQuery"
            class="spm-schema-mgr__search-clear"
            type="button"
            :title="t('clear')"
            @click="searchQuery = ''"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="spm-schema-mgr__toolbar-actions">
          <span class="spm-schema-mgr__count">
            {{ searchQuery ? t('matchedAttrsCount').replace('{count}', String(totalMatchedCount)) : `${t('totalAttrs')}: ${schemaList.length}` }}
          </span>

          <!-- 全部折叠 / 全部展开 切换按钮 -->
          <button
            class="b3-button b3-button--cancel spm-schema-mgr__action-btn"
            type="button"
            :disabled="filteredGroups.length === 0"
            @click="toggleAllCollapse"
          >
            <svg v-if="allCollapsed" class="spm-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; margin-right: 4px;"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>
            <svg v-else class="spm-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; margin-right: 4px;"><polyline points="17 11 12 6 7 11"></polyline><polyline points="17 18 12 13 7 18"></polyline></svg>
            <span>{{ allCollapsed ? t('expandAll') : t('collapseAll') }}</span>
          </button>

          <!-- 恢复默认预设按钮 -->
          <button
            class="b3-button b3-button--cancel spm-schema-mgr__action-btn spm-schema-mgr__reset-btn"
            type="button"
            :title="t('resetDefaultsDesc')"
            @click="onResetDefaults"
          >
            <svg class="spm-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; margin-right: 4px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            <span>{{ t('resetDefaults') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 属性列表按分组呈现 -->
    <div class="spm-schema-mgr__list">
      <div v-if="filteredGroups.length === 0" class="spm-schema-mgr__empty">
        {{ searchQuery ? t('noMatchingAttrs') : t('templatesEmpty') }}
      </div>

      <div
        v-for="group in filteredGroups"
        :key="group.id"
        class="spm-schema-group"
        :class="{ 'is-collapsed': isGroupCollapsed(group.id) }"
      >
        <!-- 分组头部 -->
        <div class="spm-schema-group__header" @click="toggleGroup(group.id)">
          <span class="spm-schema-group__chevron" :class="{ 'is-open': !isGroupCollapsed(group.id) }">
            <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
          <span class="spm-schema-group__title">{{ group.label }}</span>
          <span class="spm-schema-group__count">{{ group.items.length }}</span>
        </div>

        <!-- 分组内容项 -->
        <div v-show="!isGroupCollapsed(group.id)" class="spm-schema-group__body">
          <div
            v-for="item in group.items"
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
              <div v-if="item.type === 'number'" class="spm-schema-mgr__format">
                <select
                  :value="item.numberFormat ?? DEFAULT_NUMBER_FORMAT"
                  class="b3-select"
                  :title="t('numberFormatLabel')"
                  @change="onNumberFormatChange(item.name, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="fmt in NUMBER_FORMAT_OPTIONS" :key="fmt.value" :value="fmt.value">
                    {{ t(fmt.labelKey) }}
                  </option>
                </select>
              </div>
              <div v-else-if="item.type === 'date'" class="spm-schema-mgr__format">
                <select
                  :value="item.dateFormat ?? DEFAULT_DATE_FORMAT"
                  class="b3-select"
                  :title="t('dateFormatLabel')"
                  @change="onDateFormatChange(item.name, ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="fmt in DATE_FORMAT_OPTIONS" :key="fmt.value" :value="fmt.value">
                    {{ t(fmt.labelKey) }}
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
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { AttrSchemaItem, AttrType } from '@/types/schema'
import { computed, inject, nextTick, reactive, ref } from 'vue'
import { showMessage } from 'siyuan'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import {
  DATE_FORMAT_OPTIONS,
  DEFAULT_DATE_FORMAT,
  DEFAULT_NUMBER_FORMAT,
  NUMBER_FORMAT_OPTIONS,
  ATTR_TYPE_METAS,
} from '@/constants/schema'
import { groupSchemas } from '@/constants/schemaGroups'
import type { GroupedSchemaSection } from '@/constants/schemaGroups'
import { matchQuery } from '@/utils/autocomplete'
import { escapeSqlLiteral } from '@/utils/sqlLiteral'
import { parseKeyAndLabel, parseOptionInputs } from '@/utils/schemaParser'

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const {
  schemas,
  setAttrType,
  setAttrFormats,
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

// 搜索与折叠状态
const searchQuery = ref('')
const collapsedGroupIds = ref<Set<string>>(new Set())

const groupedSections = computed<GroupedSchemaSection[]>(() => {
  return groupSchemas(schemas.value, t)
})

function matchSchema(item: AttrSchemaItem, q: string): boolean {
  if (!q)
    return true
  if (matchQuery(item.name, q).matched)
    return true
  const rawKey = item.name.startsWith(CUSTOM_KEY_PREFIX) ? item.name.slice(CUSTOM_KEY_PREFIX.length) : item.name
  if (matchQuery(rawKey, q).matched)
    return true
  if (item.label && matchQuery(item.label, q).matched)
    return true
  if (item.options) {
    for (const opt of item.options) {
      if (opt.label && matchQuery(opt.label, q).matched)
        return true
      if (opt.value && matchQuery(opt.value, q).matched)
        return true
    }
  }
  return false
}

const filteredGroups = computed<GroupedSchemaSection[]>(() => {
  const q = searchQuery.value.trim()
  if (!q)
    return groupedSections.value

  const res: GroupedSchemaSection[] = []
  for (const group of groupedSections.value) {
    const matchedItems = group.items.filter(item => matchSchema(item, q))
    if (matchedItems.length > 0) {
      res.push({
        ...group,
        items: matchedItems,
      })
    }
  }
  return res
})

const totalMatchedCount = computed(() => {
  return filteredGroups.value.reduce((acc, g) => acc + g.items.length, 0)
})

function isGroupCollapsed(id: string): boolean {
  if (searchQuery.value.trim()) {
    return false // 搜索过滤时自动展开呈现命中属性
  }
  return collapsedGroupIds.value.has(id)
}

function toggleGroup(id: string) {
  if (collapsedGroupIds.value.has(id)) {
    collapsedGroupIds.value.delete(id)
  }
  else {
    collapsedGroupIds.value.add(id)
  }
  collapsedGroupIds.value = new Set(collapsedGroupIds.value)
}

const allCollapsed = computed(() => {
  const visible = filteredGroups.value
  if (visible.length === 0)
    return false
  return visible.every(g => collapsedGroupIds.value.has(g.id))
})

function toggleAllCollapse() {
  if (allCollapsed.value) {
    collapsedGroupIds.value.clear()
  }
  else {
    for (const g of filteredGroups.value) {
      collapsedGroupIds.value.add(g.id)
    }
  }
  collapsedGroupIds.value = new Set(collapsedGroupIds.value)
}

const canAdd = computed(() => {
  const parsed = parseKeyAndLabel(newKey.value)
  if (!parsed.key)
    return false
  const suffix = parsed.key.startsWith(CUSTOM_KEY_PREFIX) ? parsed.key.slice(CUSTOM_KEY_PREFIX.length) : parsed.key
  return isValidCustomSuffix(suffix)
})

function addNewSchema() {
  if (!canAdd.value)
    return
  const parsed = parseKeyAndLabel(newKey.value)
  const suffix = parsed.key.startsWith(CUSTOM_KEY_PREFIX) ? parsed.key.slice(CUSTOM_KEY_PREFIX.length) : parsed.key
  const fullKey = CUSTOM_KEY_PREFIX + suffix
  setAttrType(fullKey, newType.value, parsed.label)
  newKey.value = ''
  // 新增后若处于折叠状态，确保自定义分组展开
  collapsedGroupIds.value.delete('custom')
  collapsedGroupIds.value = new Set(collapsedGroupIds.value)
}

function onTypeChange(name: string, type: AttrType) {
  setAttrType(name, type)
}

function onNumberFormatChange(name: string, value: string) {
  setAttrFormats(name, { numberFormat: value as 'number' | 'currency' | 'percent' })
}

function onDateFormatChange(name: string, value: string) {
  setAttrFormats(name, { dateFormat: value })
}

/** 统计仍使用旧属性名的块数（跨全库）。 */
async function countBlocksUsingKey(key: string): Promise<number> {
  const { sql } = await import('@/api')
  const rows = await sql(`SELECT COUNT(DISTINCT block_id) AS cnt FROM attributes WHERE name = '${escapeSqlLiteral(key)}'`)
  return Number(rows?.[0]?.cnt ?? 0)
}

/** 将所有块上的旧属性名改写为新属性名（值不变，旧键写空串即删除）。 */
async function rewriteAttrKeyOnBlocks(oldKey: string, newKey: string): Promise<void> {
  const { sql, getBlockAttrs, setBlockAttrs } = await import('@/api')
  const rows = await sql(`SELECT DISTINCT block_id AS id FROM attributes WHERE name = '${escapeSqlLiteral(oldKey)}' AND value != '' LIMIT 9999`)
  let done = 0
  let failed = 0
  for (const row of rows ?? []) {
    const id = row?.id
    if (!id)
      continue
    try {
      const attrs = await getBlockAttrs(id)
      const val = attrs?.[oldKey]
      if (typeof val === 'string' && val !== '') {
        await setBlockAttrs(id, { [newKey]: val, [oldKey]: '' })
        done++
      }
    }
    catch {
      failed++
    }
  }
  if (done > 0)
    showMessage(t('renameRewriteDone').replace('{count}', String(done)), 3000, 'info')
  if (failed > 0)
    showMessage(t('renameRewriteFailed').replace('{count}', String(failed)), 5000, 'error')
}

function addOptionToSchema(name: string) {
  const raw = optionInputs[name]
  if (!raw)
    return
  const options = parseOptionInputs(raw)
  if (options.length === 0)
    return
  for (const opt of options) {
    addAttrOption(name, { label: opt, value: opt })
  }
  optionInputs[name] = ''
}

function startRename(name: string) {
  editingKey.value = name
  const existing = schemas.value[name]
  const suffix = name.startsWith(CUSTOM_KEY_PREFIX) ? name.slice(CUSTOM_KEY_PREFIX.length) : name
  renameDraft.value = existing?.label ? `${suffix} (${existing.label})` : suffix
  nextTick(() => {
    renameInputEl.value?.focus()
    renameInputEl.value?.select()
  })
}

function cancelRename() {
  editingKey.value = null
  renameDraft.value = ''
}

async function commitRename(oldName: string) {
  if (editingKey.value !== oldName)
    return
  const parsed = parseKeyAndLabel(renameDraft.value)
  if (!parsed.key) {
    cancelRename()
    return
  }
  const suffix = parsed.key.startsWith(CUSTOM_KEY_PREFIX) ? parsed.key.slice(CUSTOM_KEY_PREFIX.length) : parsed.key
  if (!isValidCustomSuffix(suffix)) {
    showMessage(t('invalidKey'), 3000, 'error')
    cancelRename()
    return
  }
  const newFullName = CUSTOM_KEY_PREFIX + suffix
  if (newFullName !== oldName) {
    let rewrite = false
    try {
      const count = await countBlocksUsingKey(oldName)
      if (count > 0) {
        rewrite = window.confirm(t('renameRewriteConfirm').replace('{count}', String(count)))
      }
    }
    catch {
      // 统计失败不阻断重命名，仅跳过改写
    }
    renameSchema(oldName, newFullName, parsed.label)
    if (rewrite) {
      try {
        await rewriteAttrKeyOnBlocks(oldName, newFullName)
      }
      catch (err: any) {
        showMessage(`${t('saveError')}: ${err?.message ?? ''}`, 5000, 'error')
      }
    }
  }
  else {
    renameSchema(oldName, newFullName, parsed.label)
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
