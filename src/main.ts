import type { App as VueApp } from 'vue'
import type { Plugin } from 'siyuan'
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import App from './App.vue'
import SchemaManager from './components/SchemaManager.vue'
import BatchRefactorDialog from './components/BatchRefactorDialog.vue'

let plugin: Plugin | null = null

export function usePlugin(pluginProps?: Plugin): Plugin {
  if (pluginProps)
    plugin = pluginProps
  if (!plugin) {
    // 仅在异常调用时报错，正常生命周期内 onload() 一定先于挂载执行
    throw new Error('[siyuan-property-manager] plugin not bound yet')
  }
  return plugin
}

const mounts = new WeakMap<HTMLElement, VueApp>()

/**
 * 把面板挂载到 dock 容器上。multi-mount 安全：同一 host 重复调用会被忽略。
 */
export function mountPanel(host: HTMLElement): void {
  if (mounts.has(host))
    return
  host.classList.add('siyuan-property-manager-host')
  const app = createApp(App)
  app.provide('plugin', usePlugin())
  app.mount(host)
  mounts.set(host, app)
}

export function unmountPanel(host: HTMLElement): void {
  const app = mounts.get(host)
  if (!app)
    return
  app.unmount()
  mounts.delete(host)
  host.classList.remove('siyuan-property-manager-host')
}

export function mountSchemaManager(host: HTMLElement): () => void {
  const app = createApp(SchemaManager)
  app.provide('plugin', usePlugin())
  app.mount(host)
  return () => {
    app.unmount()
  }
}

interface DialogSize {
  width: number
  height: number
}

const STORAGE_SCHEMA_DIALOG_SIZE = 'spm_schema_dialog_size'
const DEFAULT_DIALOG_WIDTH = 720
const DEFAULT_DIALOG_HEIGHT = 620

export function loadSchemaDialogSize(): DialogSize {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(STORAGE_SCHEMA_DIALOG_SIZE) : null
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed?.width === 'number' && typeof parsed?.height === 'number') {
        const maxWidth = Math.max(320, window.innerWidth - 40)
        const maxHeight = Math.max(240, window.innerHeight - 60)
        return {
          width: Math.min(Math.max(parsed.width, 480), maxWidth),
          height: Math.min(Math.max(parsed.height, 360), maxHeight),
        }
      }
    }
  }
  catch {
    // 忽略异常
  }
  const maxWidth = typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 40) : DEFAULT_DIALOG_WIDTH
  const maxHeight = typeof window !== 'undefined' ? Math.max(240, window.innerHeight - 60) : DEFAULT_DIALOG_HEIGHT
  return {
    width: Math.min(DEFAULT_DIALOG_WIDTH, maxWidth),
    height: Math.min(DEFAULT_DIALOG_HEIGHT, maxHeight),
  }
}

export function saveSchemaDialogSize(containerEl?: HTMLElement | null): void {
  if (!containerEl || typeof window === 'undefined')
    return
  const w = containerEl.offsetWidth
  const h = containerEl.offsetHeight
  if (w > 200 && h > 150) {
    try {
      window.localStorage.setItem(STORAGE_SCHEMA_DIALOG_SIZE, JSON.stringify({ width: w, height: h }))
    }
    catch {
      // 忽略存储异常
    }
  }
}

interface MountableDialogOptions {
  positionId: string
  title: string
  /** 内容宿主容器的 class（Dialog content 为 `<div class="{hostClass}"></div>`）。 */
  hostClass: string
  width: string
  height: string
  /** 挂载 Vue 实例到宿主，返回卸载函数（`dialog` 为正在构造的 Dialog 实例）。 */
  mount: (host: HTMLElement, dialog: Dialog) => () => void
  /** Dialog 销毁时、卸载组件前执行的收尾（如保存对话框尺寸）。 */
  beforeUnmount?: (dialog: Dialog) => void
  /** Dialog 拖拽缩放回调（可选）。 */
  onResize?: (dialog: Dialog) => void
}

/** 「Dialog 脚手架 + Vue 宿主挂载」的公共流程：构造、flex 布局、host 查询、mount 记账、destroy 接线。 */
function openMountableDialog(options: MountableDialogOptions): Dialog {
  let unmount: (() => void) | undefined

  const dialog = new Dialog({
    positionId: options.positionId,
    title: options.title,
    content: `<div class="${options.hostClass}"></div>`,
    width: options.width,
    height: options.height,
    destroyCallback: () => {
      options.beforeUnmount?.(dialog)
      unmount?.()
    },
    resizeCallback: options.onResize
      ? () => options.onResize!(dialog)
      : undefined,
  })

  dialog.element?.setAttribute('data-key', options.positionId)

  const container = dialog.element?.querySelector('.b3-dialog__container') as HTMLElement | null
  if (container) {
    container.style.display = 'flex'
    container.style.flexDirection = 'column'
  }

  const host = dialog.element?.querySelector(`.${options.hostClass}`) as HTMLElement | null
  if (host) {
    unmount = options.mount(host, dialog)
  }
  return dialog
}

export function openSchemaManagerDialog(pluginInstance?: Plugin): Dialog {
  const currentPlugin = pluginInstance || usePlugin()
  const { width, height } = loadSchemaDialogSize()

  return openMountableDialog({
    positionId: 'spm-schema-manager',
    title: (currentPlugin.i18n?.settingSchemaTitle as string) ?? 'Global Attribute Types',
    hostClass: 'spm-schema-dialog-host',
    width: `${width}px`,
    height: `${height}px`,
    mount: host => mountSchemaManager(host),
    beforeUnmount: dialog => saveSchemaDialogSize(dialog.element?.querySelector('.b3-dialog__container')),
    onResize: dialog => saveSchemaDialogSize(dialog.element?.querySelector('.b3-dialog__container')),
  })
}

export function mountBatchRefactor(
  host: HTMLElement,
  props: any,
  onClose: () => void,
): () => void {
  const app = createApp(BatchRefactorDialog, {
    ...props,
    onClose,
  })
  app.provide('plugin', usePlugin())
  app.mount(host)
  return () => {
    app.unmount()
  }
}

export function openBatchRefactorDialog(
  props: any,
  pluginInstance?: Plugin,
): Dialog {
  const currentPlugin = pluginInstance || usePlugin()

  return openMountableDialog({
    positionId: 'spm-batch-refactor',
    title: (currentPlugin.i18n?.batchRefactorTitle as string) ?? (currentPlugin.i18n?.batchRefactor as string) ?? '批量重命名',
    hostClass: 'spm-batch-refactor-host',
    width: '660px',
    height: '620px',
    mount: (host, dialog) => mountBatchRefactor(host, props, () => {
      dialog.destroy()
    }),
  })
}



