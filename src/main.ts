import type { App as VueApp } from 'vue'
import type { Plugin } from 'siyuan'
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import App from './App.vue'
import SchemaManager from './components/SchemaManager.vue'

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

export function openSchemaManagerDialog(pluginInstance?: Plugin): Dialog {
  const currentPlugin = pluginInstance || usePlugin()
  let unmount: (() => void) | undefined

  const { width, height } = loadSchemaDialogSize()

  const dialog = new Dialog({
    positionId: 'spm-schema-manager',
    title: (currentPlugin.i18n?.settingSchemaTitle as string) ?? 'Global Attribute Types',
    content: '<div class="spm-schema-dialog-host"></div>',
    width: `${width}px`,
    height: `${height}px`,
    destroyCallback: () => {
      saveSchemaDialogSize(dialog.element?.querySelector('.b3-dialog__container'))
      unmount?.()
    },
    resizeCallback: () => {
      saveSchemaDialogSize(dialog.element?.querySelector('.b3-dialog__container'))
    },
  })

  dialog.element?.setAttribute('data-key', 'spm-schema-manager')

  const container = dialog.element?.querySelector('.b3-dialog__container') as HTMLElement | null
  if (container) {
    container.style.display = 'flex'
    container.style.flexDirection = 'column'
  }

  const host = dialog.element?.querySelector('.spm-schema-dialog-host') as HTMLElement | null
  if (host) {
    unmount = mountSchemaManager(host)
  }
  return dialog
}


