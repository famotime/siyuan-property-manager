<template>
  <AttrSection
    :title="t('templatesTitle')"
    :count="templates.length"
    storage-key="templates"
    :default-open="true"
  >
    <div v-if="!templates.length" class="spm-tpl-empty">{{ t('templatesEmpty') }}</div>

    <div v-for="tpl in templates" :key="tpl.id" class="spm-tpl">
      <div class="spm-tpl__header" @click="toggleTemplate(tpl.id)">
        <span class="spm-tpl__chevron" :class="{ 'is-open': tpl.open }">▸</span>

        <template v-if="editingId === tpl.id">
          <input
            ref="nameInputRef"
            v-model="editingName"
            class="spm-tpl__name-editor b3-text-field"
            type="text"
            spellcheck="false"
            @blur="commitRename(tpl)"
            @keydown.enter.prevent="commitRename(tpl)"
            @keydown.escape.prevent="cancelRename"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="spm-tpl__name" @dblclick.stop="startRename(tpl)">{{ tpl.name }}</span>
        </template>

        <span class="spm-tpl__count">{{ tpl.attrs.length }}</span>

        <span class="spm-tpl__actions">
          <button
            class="spm-tpl__apply"
            type="button"
            :title="t('templatesApply')"
            :disabled="!tpl.attrs.length"
            @click.stop="onApplyAll(tpl)"
          >
            ＋
          </button>
          <button
            class="spm-tpl__remove"
            type="button"
            :title="t('templatesDelete')"
            @click.stop="removeTemplate(tpl.id)"
          >✕</button>
        </span>
      </div>

      <div v-show="tpl.open" class="spm-tpl__body">
        <div
          v-for="(attr, idx) in tpl.attrs"
          :key="idx"
          class="spm-tpl__attr"
        >
          <span class="spm-tpl__attr-key" :title="'custom-' + attr.key">
            <span class="spm-tpl__attr-prefix" aria-hidden="true" style="display:none">custom-</span>{{ attr.key }}
          </span>
          <span class="spm-tpl__attr-value">{{ attr.value || t('emptyValue') }}</span>
          <button
            class="spm-tpl__attr-remove"
            type="button"
            :title="t('deleteAttr')"
            @click="removeTemplateAttr(tpl.id, idx)"
          >✕</button>
        </div>

        <div class="spm-tpl__add">
          <label class="spm-tpl__add-key">
            <span class="spm-tpl__add-prefix" aria-hidden="true" style="display:none">custom-</span>
            <input
              v-model="newKeys[tpl.id]"
              class="b3-text-field spm-tpl__add-suffix"
              type="text"
              :placeholder="t('keyPlaceholder')"
              spellcheck="false"
              @keydown.enter.prevent="onAddAttr(tpl.id)"
              @blur="touchKey(tpl.id)"
            />
          </label>
          <input
            v-model="newValues[tpl.id]"
            class="b3-text-field spm-tpl__add-value"
            type="text"
            :placeholder="t('valuePlaceholder')"
            @keydown.enter.prevent="onAddAttr(tpl.id)"
          />
          <button
            class="spm-tpl__add-commit"
            type="button"
            :disabled="!isAddValid(tpl.id)"
            :title="t('addProperty')"
            @click="onAddAttr(tpl.id)"
          >✓</button>
          <div v-if="touchedKeys[tpl.id] && newKeys[tpl.id] && !isAddValid(tpl.id)" class="spm-tpl__add-hint">
            {{ t('invalidKey') }}
          </div>
          <div v-else-if="addErrors[tpl.id]" class="spm-tpl__add-hint spm-tpl__add-hint--error">
            {{ addErrors[tpl.id] }}
          </div>
        </div>
      </div>
    </div>

    <button class="spm-tpl__new-btn" type="button" @click="addTemplate(t('templateDefaultName'))">
      <span>+</span> {{ t('templatesNew') }}
    </button>
  </AttrSection>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject, nextTick, reactive, ref } from 'vue'
import { showMessage } from 'siyuan'
import AttrSection from './AttrSection.vue'
import { useTemplates } from '@/composables/useTemplates'
import type { AttrTemplate } from '@/composables/useTemplates'
import { isValidCustomSuffix } from '@/constants/attrs'

const props = defineProps<{
  onApply: (suffix: string, value: string) => Promise<void> | void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const {
  templates,
  addTemplate,
  removeTemplate,
  renameTemplate,
  toggleTemplate,
  addTemplateAttr,
  removeTemplateAttr,
} = useTemplates()

/* ---- 模板名编辑 ---- */
const editingId = ref<string | null>(null)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement[]>([])

function startRename(tpl: AttrTemplate) {
  editingId.value = tpl.id
  editingName.value = tpl.name
  nextTick(() => {
    const input = nameInputRef.value?.[0]
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function commitRename(tpl: AttrTemplate) {
  const name = editingName.value.trim()
  if (name)
    renameTemplate(tpl.id, name)
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

/* ---- 添加属性到模板 ---- */
const newKeys = reactive<Record<string, string>>({})
const newValues = reactive<Record<string, string>>({})
const touchedKeys = reactive<Record<string, boolean>>({})
const addErrors = reactive<Record<string, string>>({})

function isAddValid(id: string): boolean {
  const key = newKeys[id]
  return !!key && isValidCustomSuffix(key)
}

function touchKey(id: string) {
  touchedKeys[id] = true
}

async function onAddAttr(id: string) {
  touchedKeys[id] = true
  addErrors[id] = ''
  if (!isAddValid(id))
    return
  const err = addTemplateAttr(id, newKeys[id], newValues[id] || '')
  if (err) {
    addErrors[id] = t(err === 'duplicate' ? 'templatesDuplicate' : 'invalidKey')
    return
  }
  newKeys[id] = ''
  newValues[id] = ''
  touchedKeys[id] = false
}

/* ---- 应用模板 ---- */
async function onApplyAll(tpl: AttrTemplate) {
  if (!tpl.attrs.length)
    return
  let applied = 0
  let skipped = 0
  for (const attr of tpl.attrs) {
    try {
      await props.onApply(attr.key, attr.value)
      applied++
    }
    catch {
      skipped++
    }
  }
  if (skipped > 0)
    showMessage(t('templatesApplyPartial').replace('{applied}', String(applied)).replace('{skipped}', String(skipped)), 4000, 'error')
  else
    showMessage(t('templatesApplySuccess').replace('{count}', String(applied)), 3000)
}
</script>
