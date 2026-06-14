<template>
  <div class="spm-add" :class="{ 'spm-add--invalid': touched && !valid }">
    <label class="spm-add__key">
      <span class="spm-add__prefix" aria-hidden="true" :title="prefix" style="display:none">{{ prefix }}</span>
      <input
        v-model="suffix"
        class="b3-text-field spm-add__suffix"
        type="text"
        :placeholder="t('keyPlaceholder')"
        spellcheck="false"
        @keydown.enter.prevent="onCommit"
        @blur="touched = true"
      />
    </label>
    <input
      v-model="value"
      class="b3-text-field spm-add__value"
      type="text"
      :placeholder="t('valuePlaceholder')"
      @keydown.enter.prevent="onCommit"
    />
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
import { computed, inject, ref } from 'vue'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'

const prefix = CUSTOM_KEY_PREFIX

const props = defineProps<{
  onAdd: (suffix: string, value: string) => Promise<void> | void
}>()

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const suffix = ref('')
const value = ref('')
const touched = ref(false)
const errorMessage = ref('')
const submitting = ref(false)

const valid = computed(() => !!suffix.value && isValidCustomSuffix(suffix.value))

async function onCommit() {
  touched.value = true
  errorMessage.value = ''
  if (!valid.value || submitting.value)
    return
  submitting.value = true
  try {
    await props.onAdd(suffix.value, value.value)
    suffix.value = ''
    value.value = ''
    touched.value = false
  }
  catch (err: any) {
    errorMessage.value = err?.message ?? t('saveError')
  }
  finally {
    submitting.value = false
  }
}
</script>
