<template>
  <div
    class="spm-row"
    :class="{
      'spm-row--readonly': readonly,
      'spm-row--editing': editing,
      'spm-row--saving': state === 'saving',
      'spm-row--error': state === 'error',
    }"
  >
    <div class="spm-row__key" :title="row.key">
      <span v-if="readonly" class="spm-row__lock" :title="readonlyTooltip">
        <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24" style="opacity: 0.6; display: inline-block; vertical-align: middle; margin-right: 2px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
      </span>
      <span class="spm-row__key-text">{{ label }}</span>
    </div>

    <div class="spm-row__value">
      <template v-if="editing">
        <textarea
          v-if="useTextarea"
          ref="editorEl"
          v-model="draft"
          class="b3-text-field spm-row__editor"
          rows="3"
          @blur="commit"
          @keydown.esc.prevent="cancel"
          @keydown.enter.ctrl.prevent="($event.target as HTMLTextAreaElement)?.blur()"
          @keydown.enter.meta.prevent="($event.target as HTMLTextAreaElement)?.blur()"
        />
        <input
          v-else
          ref="editorEl"
          v-model="draft"
          class="b3-text-field spm-row__editor"
          type="text"
          @blur="commit"
          @keydown.esc.prevent="cancel"
          @keydown.enter.prevent="($event.target as HTMLInputElement)?.blur()"
        />
      </template>
      <template v-else>
        <span
          class="spm-row__display"
          :class="{ 'spm-row__display--empty': isEmpty, 'spm-row__display--readonly': readonly }"
          :title="readonly ? value : emptyHint"
          @click="enterEdit"
        >{{ displayValue }}</span>
      </template>
    </div>

    <div class="spm-row__trail">
      <span v-if="state === 'saving'" class="spm-row__indicator spm-row__indicator--saving" :title="t('savingHint')" />
      <span v-else-if="state === 'success'" class="spm-row__indicator spm-row__indicator--success" :title="t('savedHint')">
        <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </span>
      <span v-else-if="state === 'error'" class="spm-row__indicator spm-row__indicator--error" :title="errorMessage || t('saveError')">
        <svg class="spm-icon" width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </span>
      <button
        v-if="!editing && !isEmpty"
        class="spm-row__copy"
        type="button"
        :title="t('copyAttr')"
        @click.stop="onCopy"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
      <button
        v-if="deletable && !editing"
        class="spm-row__delete"
        type="button"
        :title="t('deleteAttr')"
        @click.stop="$emit('delete', row.key)"
      >
        <svg class="spm-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import type { AttrRowVM } from '@/composables/useBlockAttrs'
import { computed, inject, nextTick, ref, toRefs, watch } from 'vue'
import { isMultiline } from '@/utils/dom'

const props = defineProps<{
  row: AttrRowVM
  /** 行标签，默认显示 row.key；自定义属性时父级可传去前缀的短名。 */
  label?: string
  /** 是否可删除（自定义属性行才显示 ✕）。 */
  deletable?: boolean
}>()

const emit = defineEmits<{
  (e: 'save', key: string, value: string): void
  (e: 'delete', key: string): void
}>()

const plugin = inject<Plugin>('plugin')

function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const { row } = toRefs(props)
const readonly = computed(() => row.value.readonly)
const value = computed(() => row.value.value)
const label = computed(() => props.label ?? row.value.key)
const isEmpty = computed(() => !value.value)
const displayValue = computed(() => value.value || t('emptyValue'))
const emptyHint = computed(() => (isEmpty.value ? t('clickToEdit') : value.value))
const readonlyTooltip = computed(() => t('readonlyTooltip'))

const editing = ref(false)
const draft = ref('')
const useTextarea = ref(false)
const editorEl = ref<HTMLInputElement | HTMLTextAreaElement | null>(null)

type SaveState = 'idle' | 'saving' | 'success' | 'error'
const state = ref<SaveState>('idle')
const errorMessage = ref('')
let successTimer: number | undefined

function clearSuccessTimer() {
  if (successTimer) {
    window.clearTimeout(successTimer)
    successTimer = undefined
  }
}

function enterEdit() {
  if (readonly.value || editing.value)
    return
  draft.value = value.value
  useTextarea.value = isMultiline(value.value)
  editing.value = true
  state.value = 'idle'
  errorMessage.value = ''
  nextTick(() => {
    const el = editorEl.value
    if (el) {
      el.focus()
      if (typeof (el as HTMLInputElement).select === 'function')
        (el as HTMLInputElement).select()
    }
  })
}

function cancel() {
  editing.value = false
  draft.value = value.value
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(value.value)
  }
  catch {
    // 静默失败
  }
}

function commit() {
  if (!editing.value)
    return
  editing.value = false
  const next = draft.value
  if (next === value.value)
    return
  emit('save', row.value.key, next)
}

// 当父级根据保存结果回填 row.value 时，外部传入的 saving/success/error 状态由组件内部驱动。
// 这里通过 watch row 自身做轻量同步：值变化即视为一次成功提交，触发短暂 ✓。
watch(value, (next, prev) => {
  if (state.value === 'saving' && next !== prev) {
    state.value = 'success'
    clearSuccessTimer()
    successTimer = window.setTimeout(() => {
      if (state.value === 'success')
        state.value = 'idle'
    }, 1200)
  }
})

// 暴露给父组件 PropertyPanel 通过 ref 设置保存状态
function markSaving() {
  state.value = 'saving'
  errorMessage.value = ''
}
function markError(message: string) {
  state.value = 'error'
  errorMessage.value = message
  clearSuccessTimer()
}
defineExpose({ markSaving, markError })
</script>
