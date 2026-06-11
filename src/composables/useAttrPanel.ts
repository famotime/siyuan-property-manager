import type { Plugin } from 'siyuan'
import type { ComponentPublicInstance, ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import { showMessage } from 'siyuan'
import { useBlockAttrs } from '@/composables/useBlockAttrs'
import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'

export type RowExposed = { markSaving: () => void, markError: (msg: string) => void }

export interface UseAttrPanel {
  loading: Ref<boolean>
  error: Ref<string | null>
  internalAttrs: ReturnType<typeof useBlockAttrs>['internalAttrs']
  customAttrs: ReturnType<typeof useBlockAttrs>['customAttrs']
  hasData: ComputedRef<boolean>
  prefix: string
  t: (key: string) => string
  attrLabel: (key: string) => string
  setRowRef: (key: string, el: Element | ComponentPublicInstance | null) => void
  onSave: (key: string, value: string) => Promise<void>
  onDelete: (key: string) => Promise<void>
  onAdd: (suffix: string, value: string) => Promise<void>
  onApplyAttr: (suffix: string, value: string) => Promise<void>
  /** 清理事件监听器，组件 onBeforeUnmount 时调用。 */
  dispose: () => void
}

/**
 * 属性面板共享逻辑 composable。
 *
 * 封装了 Dock 面板（PropertyPanel）和文档内联属性面板（DocInlineAttrs）
 * 共同需要的 i18n、行引用管理、增删改事件处理、跨实例属性同步等功能。
 */
export function useAttrPanel(
  plugin: Plugin,
  blockIdRef: Readonly<Ref<BlockId | null>>,
): UseAttrPanel {
  // ---- i18n ----
  const i18n = plugin.i18n as Record<string, string> | undefined
  function t(key: string): string {
    return i18n?.[key] ?? key
  }
  function attrLabel(key: string): string {
    return i18n?.[`attr_${key}`] ?? key
  }

  // ---- 属性数据层 ----
  const {
    loading,
    error,
    internalAttrs,
    customAttrs,
    saveAttr,
    deleteAttr,
    addCustom,
    reload,
  } = useBlockAttrs(blockIdRef)

  const hasData = computed(() => internalAttrs.value.length + customAttrs.value.length > 0)
  const prefix = CUSTOM_KEY_PREFIX

  // ---- 行引用管理 ----
  const rowRefs = new Map<string, RowExposed>()

  function setRowRef(key: string, el: Element | ComponentPublicInstance | null) {
    if (!el) {
      rowRefs.delete(key)
      return
    }
    rowRefs.set(key, el as unknown as RowExposed)
  }

  // ---- 事件处理 ----
  async function onSave(key: string, value: string) {
    const row = rowRefs.get(key)
    row?.markSaving()
    try {
      await saveAttr(key, value)
    }
    catch (err: any) {
      const msg = err?.message ?? t('saveError')
      row?.markError(msg)
      showMessage(`${t('saveError')}: ${msg}`, 5000, 'error')
    }
  }

  async function onDelete(key: string) {
    try {
      await deleteAttr(key)
    }
    catch (err: any) {
      const msg = err?.message ?? t('saveError')
      showMessage(`${t('saveError')}: ${msg}`, 5000, 'error')
    }
  }

  async function onAdd(suffix: string, value: string) {
    await addCustom(suffix, value)
  }

  async function onApplyAttr(suffix: string, value: string) {
    await addCustom(suffix, value)
  }

  // ---- 跨实例属性同步 ----
  function onAttrsChanged(e: Event) {
    const changedId = (e as CustomEvent).detail?.blockId as string | undefined
    if (changedId && changedId === blockIdRef.value)
      reload()
  }
  document.addEventListener('spm:attrs-changed', onAttrsChanged)

  function dispose() {
    document.removeEventListener('spm:attrs-changed', onAttrsChanged)
  }

  return {
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
    dispose,
  }
}
