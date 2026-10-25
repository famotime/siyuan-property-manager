<template>
  <div class="spm-add" :class="{ 'spm-add--invalid': touched && !valid }">
    <div class="spm-add__key-wrapper">
      <label class="spm-add__key">
        <span class="spm-add__prefix" aria-hidden="true" :title="prefix" style="display:none">{{ prefix }}</span>
        <input
          ref="keyInputEl"
          v-model="suffix"
          class="b3-text-field spm-add__suffix"
          type="text"
          :placeholder="t('keyPlaceholder')"
          spellcheck="false"
          @input="onKeyInput"
          @focus="onKeyFocus"
          @blur="onKeyBlur"
          @keydown.down.prevent="onKeyNavDown"
          @keydown.up.prevent="onKeyNavUp"
          @keydown.tab="onKeyTab"
          @keydown.enter.prevent="onKeyEnter"
          @keydown.esc.prevent="closeKeyDropdown"
        />
      </label>

      <!-- 属性名补全浮层 -->
      <AutocompleteDropdown
        :open="showKeyDropdown"
        :items="keySuggestions"
        :highlight-index="keyHighlightIndex"
        @select="pickKeySuggestion"
      />
    </div>

    <div class="spm-add__val-wrapper">
      <input
        ref="valInputEl"
        v-model="value"
        class="b3-text-field spm-add__value"
        type="text"
        :placeholder="t('valuePlaceholder')"
        @input="onValInput"
        @focus="onValFocus"
        @blur="onValBlur"
        @keydown.down.prevent="onValNavDown"
        @keydown.up.prevent="onValNavUp"
        @keydown.tab="onValTab"
        @keydown.enter.prevent="onValEnter"
        @keydown.esc.prevent="closeValDropdown"
      />

      <!-- 属性值建议浮层 -->
      <AutocompleteDropdown
        :open="showValDropdown"
        :items="valSuggestions"
        :highlight-index="valHighlightIndex"
        @select="pickValSuggestion"
      />
    </div>

    <button
      class="spm-add__commit"
      type="button"
      :disabled="!valid"
      :title="t('addProperty')"
      @click="onCommit"
    >
      <svg class="spm-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
    </button>
    <div v-if="touched && !valid && suffix" class="spm-add__hint">{{ t('invalidKey') }}</div>
    <div v-else-if="errorMessage" class="spm-add__hint spm-add__hint--error">{{ errorMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { computed, inject, nextTick, ref } from 'vue'
import AutocompleteDropdown from './AutocompleteDropdown.vue'
import type { AutocompleteItem } from './AutocompleteDropdown.vue'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import { DEFAULT_PRESET_SCHEMAS } from '@/constants/schema'
import { useAttrSchema } from '@/composables/useAttrSchema'
import { useSuggestDropdown } from '@/composables/useSuggestDropdown'
import {
  registerCustomKey,
  suggestCustomKeys,
  suggestCustomValues,
} from '@/utils/autocomplete'
import { parseKeyAndLabel } from '@/utils/schemaParser'
import { inferAttrType } from '@/utils/typeInference'

const prefix = CUSTOM_KEY_PREFIX

const props = defineProps<{
  onAdd: (suffix: string, value: string) => Promise<void> | void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const { getSchema, setAttrType } = useAttrSchema()

const keyInputEl = ref<HTMLInputElement | null>(null)
const valInputEl = ref<HTMLInputElement | null>(null)

const suffix = ref('')
const value = ref('')
const touched = ref(false)
const errorMessage = ref('')
const submitting = ref(false)

const valid = computed(() => {
  const parsed = parseKeyAndLabel(suffix.value)
  const actualKey = parsed.key.startsWith(CUSTOM_KEY_PREFIX)
    ? parsed.key.slice(CUSTOM_KEY_PREFIX.length)
    : parsed.key
  return !!actualKey && isValidCustomSuffix(actualKey)
})

// ---- 属性名补全 ----
const {
  items: keySuggestions,
  open: showKeyDropdown,
  highlightIndex: keyHighlightIndex,
  refresh: refreshKeySuggestions,
  close: closeKeyDropdown,
  navDown: onKeyNavDown,
  navUp: onKeyNavUp,
  getHighlighted: getHighlightedKeyItem,
  pick: pickKeySuggestion,
} = useSuggestDropdown<AutocompleteItem>(
  suffix,
  (q) => {
    const list = suggestCustomKeys(q, 8)
    return list.map((k) => {
      const full = k.startsWith(CUSTOM_KEY_PREFIX) ? k : CUSTOM_KEY_PREFIX + k
      const schema = getSchema(full) || DEFAULT_PRESET_SCHEMAS[full]
      return {
        value: k,
        label: schema?.label,
      }
    })
  },
  (item) => {
    suffix.value = typeof item === 'string' ? item : item.value
    nextTick(() => {
      valInputEl.value?.focus()
      void refreshValSuggestions()
    })
  },
)

function onKeyInput() {
  void refreshKeySuggestions()
}

function onKeyFocus() {
  void refreshKeySuggestions()
}

function onKeyBlur() {
  touched.value = true
  setTimeout(() => {
    closeKeyDropdown()
  }, 200)
}

function onKeyTab(e: KeyboardEvent) {
  const item = getHighlightedKeyItem()
  if (showKeyDropdown.value && item) {
    e.preventDefault()
    pickKeySuggestion(item)
  }
}

function onKeyEnter() {
  const item = getHighlightedKeyItem()
  if (showKeyDropdown.value && item) {
    pickKeySuggestion(item)
  }
  else if (valid.value && !value.value) {
    closeKeyDropdown()
    valInputEl.value?.focus()
    void refreshValSuggestions()
  }
  else {
    onCommit()
  }
}

// ---- 属性值联想 ----
const {
  items: valSuggestions,
  open: showValDropdown,
  highlightIndex: valHighlightIndex,
  refresh: refreshValSuggestions,
  schedule: scheduleValSuggestions,
  close: closeValDropdown,
  navDown: onValNavDown,
  navUp: onValNavUp,
  getHighlighted: getHighlightedValItem,
  pick: pickValSuggestion,
} = useSuggestDropdown<AutocompleteItem>(
  value,
  async (q) => {
    if (!suffix.value)
      return []
    const parsed = parseKeyAndLabel(suffix.value)
    const pureKey = parsed.key
    const full = pureKey.startsWith(CUSTOM_KEY_PREFIX) ? pureKey : CUSTOM_KEY_PREFIX + pureKey
    const schema = getSchema(full) || DEFAULT_PRESET_SCHEMAS[full]
    const effectiveType = schema?.type || inferAttrType(full, q)

    if (effectiveType === 'block-ref') {
      try {
        const { searchBlocksByKeyword } = await import('@/api')
        const blocks = await searchBlocksByKeyword(q, 10)
        return blocks.map((b) => {
          const isDoc = b.type === 'd'
          const icon = isDoc ? '📄' : '🔗'
          const title = isDoc ? (b.content || b.name || '文档') : (b.content || b.name || '块')
          const path = b.hPath ? ` · ${b.hPath}` : ''
          return {
            value: b.id,
            label: title,
            display: `${icon} ${title}${path}`,
          }
        })
      }
      catch {
        // 降级使用普通属性值搜索
      }
    }

    const presetOptions = schema?.options
    return await suggestCustomValues(pureKey, q, 12, presetOptions, schema?.type)
  },
  (item) => {
    value.value = typeof item === 'string' ? item : item.value
    onCommit()
  },
)

function onValInput() {
  scheduleValSuggestions()
}

function onValFocus() {
  void refreshValSuggestions()
}

function onValBlur() {
  setTimeout(() => {
    closeValDropdown()
  }, 200)
}

function onValTab(e: KeyboardEvent) {
  const item = getHighlightedValItem()
  if (showValDropdown.value && item) {
    e.preventDefault()
    pickValSuggestion(item)
  }
}

function onValEnter() {
  const item = getHighlightedValItem()
  if (showValDropdown.value && item) {
    pickValSuggestion(item)
  }
  else {
    onCommit()
  }
}

async function onCommit() {
  touched.value = true
  errorMessage.value = ''
  if (!valid.value || submitting.value)
    return
  submitting.value = true
  try {
    const parsed = parseKeyAndLabel(suffix.value)
    const k = parsed.key.startsWith(CUSTOM_KEY_PREFIX)
      ? parsed.key.slice(CUSTOM_KEY_PREFIX.length)
      : parsed.key
    const fullKey = CUSTOM_KEY_PREFIX + k
    const existingSchema = getSchema(fullKey) || DEFAULT_PRESET_SCHEMAS[fullKey]
    if (parsed.label) {
      setAttrType(fullKey, existingSchema?.type || inferAttrType(fullKey, value.value), parsed.label)
    }
    else if (!existingSchema && inferAttrType(fullKey, value.value) === 'block-ref') {
      setAttrType(fullKey, 'block-ref')
    }
    await props.onAdd(k, value.value)
    registerCustomKey(k)
    suffix.value = ''
    value.value = ''
    touched.value = false
    closeKeyDropdown()
    closeValDropdown()
  }
  catch (err: any) {
    errorMessage.value = err?.message ?? t('saveError')
  }
  finally {
    submitting.value = false
  }
}
</script>
