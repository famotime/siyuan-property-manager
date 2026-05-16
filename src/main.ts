import type { App as VueApp } from 'vue'
import type { Plugin } from 'siyuan'
import { createApp } from 'vue'
import App from './App.vue'

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
