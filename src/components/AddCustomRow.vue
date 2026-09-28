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
        @select="selectKeySuggestion"
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
        @select="selectValSuggestion"
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
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import {
  registerCustomKey,
  suggestCustomKeys,
  suggestCustomValues,
} from '@/utils/autocomplete'

const prefix = CUSTOM_KEY_PREFIX

const props = defineProps<{
  onAdd: (suffix: string, value: string) => Promise<void> | void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const keyInputEl = ref<HTMLInputElement | null>(null)
const valInputEl = ref<HTMLInputElement | null>(null)

const suffix = ref('')
const value = ref('')
const touched = ref(false)
const errorMessage = ref('')
const submitting = ref(false)

const valid = computed(() => !!suffix.value && isValidCustomSuffix(suffix.value))

// ---- 属性名补全 ----
const keySuggestions = ref<string[]>([])
const showKeyDropdown = ref(false)
const keyHighlightIndex = ref(0)

function onKeyInput() {
  updateKeySuggestions()
}

function onKeyFocus() {
  updateKeySuggestions()
}

function updateKeySuggestions() {
  const list = suggestCustomKeys(suffix.value, 8)
  keySuggestions.value = list
  keyHighlightIndex.value = 0
  showKeyDropdown.value = list.length > 0
}

function onKeyBlur() {
  touched.value = true
  setTimeout(() => {
    closeKeyDropdown()
  }, 200)
}

function closeKeyDropdown() {
  showKeyDropdown.value = false
}

function selectKeySuggestion(key: string) {
  suffix.value = key
  closeKeyDropdown()
  nextTick(() => {
    valInputEl.value?.focus()
    updateValSuggestions()
  })
}

function onKeyNavDown() {
  if (!showKeyDropdown.value || keySuggestions.value.length === 0)
    return
  keyHighlightIndex.value = (keyHighlightIndex.value + 1) % keySuggestions.value.length
}

function onKeyNavUp() {
  if (!showKeyDropdown.value || keySuggestions.value.length === 0)
    return
  keyHighlightIndex.value = (keyHighlightIndex.value - 1 + keySuggestions.value.length) % keySuggestions.value.length
}

function onKeyTab(e: KeyboardEvent) {
  if (showKeyDropdown.value && keySuggestions.value[keyHighlightIndex.value]) {
    e.preventDefault()
    selectKeySuggestion(keySuggestions.value[keyHighlightIndex.value])
  }
}

function onKeyEnter() {
  if (showKeyDropdown.value && keySuggestions.value[keyHighlightIndex.value]) {
    selectKeySuggestion(keySuggestions.value[keyHighlightIndex.value])
  }
  else {
    onCommit()
  }
}

// ---- 属性值联想 ----
const valSuggestions = ref<string[]>([])
const showValDropdown = ref(false)
const valHighlightIndex = ref(0)
let valDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onValInput() {
  triggerValSuggestions()
}

function onValFocus() {
  triggerValSuggestions()
}

function triggerValSuggestions() {
  if (valDebounceTimer)
    clearTimeout(valDebounceTimer)
  valDebounceTimer = setTimeout(async () => {
    await updateValSuggestions()
  }, 100)
}

async function updateValSuggestions() {
  if (!suffix.value) {
    valSuggestions.value = []
    showValDropdown.value = false
    return
  }
  const list = await suggestCustomValues(suffix.value, value.value, 8)
  valSuggestions.value = list
  valHighlightIndex.value = 0
  showValDropdown.value = list.length > 0
}

function onValBlur() {
  setTimeout(() => {
    closeValDropdown()
  }, 200)
}

function closeValDropdown() {
  showValDropdown.value = false
}

function selectValSuggestion(val: string) {
  value.value = val
  closeValDropdown()
  onCommit()
}

function onValNavDown() {
  if (!showValDropdown.value || valSuggestions.value.length === 0)
    return
  valHighlightIndex.value = (valHighlightIndex.value + 1) % valSuggestions.value.length
}

function onValNavUp() {
  if (!showValDropdown.value || valSuggestions.value.length === 0)
    return
  valHighlightIndex.value = (valHighlightIndex.value - 1 + valSuggestions.value.length) % valSuggestions.value.length
}

function onValTab(e: KeyboardEvent) {
  if (showValDropdown.value && valSuggestions.value[valHighlightIndex.value]) {
    e.preventDefault()
    selectValSuggestion(valSuggestions.value[valHighlightIndex.value])
  }
}

function onValEnter() {
  if (showValDropdown.value && valSuggestions.value[valHighlightIndex.value]) {
    selectValSuggestion(valSuggestions.value[valHighlightIndex.value])
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
    const k = suffix.value
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
