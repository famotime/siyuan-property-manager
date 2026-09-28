import { Dialog, getFrontend, Plugin, Setting } from 'siyuan'
import '@/index.scss'
import '@/scss/types.scss'
import { mountDocInlineAttrs, unmountDocInlineAttrs } from '@/docInlineAttrs'
import { mountPanel, mountSchemaManager, unmountPanel, usePlugin } from '@/main'
import { openMobileDrawer, unmountMobileSheet } from '@/mobileSheet'
import { getRuntimeSettings, normalizeSettings, SETTINGS_STORAGE_NAME, setRuntimeSettings } from '@/settings'
import { initTemplates, TEMPLATES_STORAGE_NAME } from '@/composables/useTemplates'
import { initSchemas } from '@/composables/useAttrSchema'
import { TYPES_SCHEMA_STORAGE_NAME } from '@/constants/schema'
import { initCustomKeysCache } from '@/utils/autocomplete'

const DOCK_TYPE = 'property-manager-dock'

const ICON_SVG = '<symbol id="iconPropertyManager" viewBox="0 0 48 48"><path d="M32.9037 13.9272C31.2464 17.1588 27.8814 19.3702 24 19.3702C20.1185 19.3702 16.7536 17.1588 15.0963 13.9272C11.3982 16.6591 9 21.0495 9 26.0001C9 26.8178 9.06543 27.6202 9.19135 28.4024C9.45807 28.3811 9.72775 28.3702 9.99996 28.3702C15.5228 28.3702 20 32.8474 20 38.3702C20 39.0665 19.9288 39.7461 19.7934 40.4022C21.128 40.7914 22.5397 41.0001 24 41.0001C25.4603 41.0001 26.8719 40.7914 28.2066 40.4022C28.0711 39.7461 28 39.0665 28 38.3702C28 32.8474 32.4771 28.3702 38 28.3702C38.2722 28.3702 38.5419 28.3811 38.8087 28.4024C38.9346 27.6202 39 26.8178 39 26.0001C39 21.0495 36.6017 16.6591 32.9037 13.9272Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M24 13C26.2091 13 28 11.2091 28 9C28 6.79086 26.2091 5 24 5C21.7909 5 20 6.79086 20 9C20 11.2091 21.7909 13 24 13Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9 43C11.2091 43 13 41.2091 13 39C13 36.7909 11.2091 35 9 35C6.79086 35 5 36.7909 5 39C5 41.2091 6.79086 43 9 43Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M39 43C41.2091 43 43 41.2091 43 39C43 36.7909 41.2091 35 39 35C36.7909 35 35 36.7909 35 39C35 41.2091 36.7909 43 39 43Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></symbol>'

export default class PropertyManagerPlugin extends Plugin {
  public isMobile = false
  public platform: SyFrontendTypes = 'desktop' as SyFrontendTypes
  private wsMainDebounceTimers = new Map<string, number>()
  private onWsMainBound?: (event: CustomEvent<any>) => void

  async onload() {
    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === 'mobile' || frontEnd === 'browser-mobile'

    this.addIcons(ICON_SVG)

    // 让 mountPanel 内部能取到 plugin 实例
    usePlugin(this)
    await this.loadSettings()
    await initTemplates(this)
    await initSchemas(this)
    void initCustomKeysCache()

    // 注册顶部快捷栏按钮（移动端专属唤起抽屉，桌面端唤起/切换侧边栏 Dock）
    this.addTopBar({
      icon: 'iconPropertyManager',
      title: (this.i18n.dockTitle as string) ?? 'Block Properties',
      position: 'right',
      callback: () => {
        if (this.isMobile) {
          openMobileDrawer(this)
        }
        else {
          this.toggleDockPanel()
        }
      },
    })

    this.addDock({
      config: {
        position: 'RightTop',
        size: { width: 280, height: 0 },
        icon: 'iconPropertyManager',
        title: (this.i18n.dockTitle as string) ?? 'Block Properties',
      },
      data: {},
      type: DOCK_TYPE,
      init() {
        mountPanel(this.element as HTMLElement)
      },
      destroy() {
        unmountPanel(this.element as HTMLElement)
      },
    })

    mountDocInlineAttrs(this)

    // 监听 WebSocket 主通道消息以实现实时属性刷新
    this.onWsMainBound = this.onWsMain.bind(this)
    this.eventBus.on('ws-main', this.onWsMainBound)
  }

  onunload() {
    unmountDocInlineAttrs()
    unmountMobileSheet()
    // dock 关闭时 petal 会自动调用 destroy 回调，这里无需手工卸载组件。

    // 注销 WebSocket 监听并清理所有定时器，防止内存泄漏
    if (this.onWsMainBound) {
      this.eventBus.off('ws-main', this.onWsMainBound)
    }
    for (const timer of this.wsMainDebounceTimers.values()) {
      window.clearTimeout(timer)
    }
    this.wsMainDebounceTimers.clear()
  }

  async uninstall() {
    await Promise.all([
      this.removeData(SETTINGS_STORAGE_NAME),
      this.removeData(TEMPLATES_STORAGE_NAME),
      this.removeData(TYPES_SCHEMA_STORAGE_NAME),
    ])
  }

  private onWsMain(event: CustomEvent<any>) {
    const detail = event.detail
    if (!detail)
      return

    const cmd = detail.cmd
    if (cmd === 'transactions') {
      const txs = detail.data
      if (!Array.isArray(txs))
        return

      const changedIds = new Set<string>()
      for (const tx of txs) {
        if (!tx)
          continue
        const ops = tx.doOperations
        if (!Array.isArray(ops))
          continue
        for (const op of ops) {
          if (op) {
            const id = op.id || op.blockID
            if (id) {
              changedIds.add(id)
            }
          }
        }
      }

      for (const id of changedIds) {
        // 对每个 blockId 触发的事件进行 150ms 防抖，避免连续修改或输入时频繁请求 API
        const existingTimer = this.wsMainDebounceTimers.get(id)
        if (existingTimer) {
          window.clearTimeout(existingTimer)
        }
        const timer = window.setTimeout(() => {
          this.wsMainDebounceTimers.delete(id)
          document.dispatchEvent(
            new CustomEvent('spm:attrs-changed', { detail: { blockId: id } }),
          )
        }, 150)
        this.wsMainDebounceTimers.set(id, timer)
      }
    }
  }

  async loadSettings() {
    try {
      const stored = await this.loadData(SETTINGS_STORAGE_NAME)
      setRuntimeSettings(normalizeSettings(stored))
    }
    catch {
      setRuntimeSettings({})
    }
  }

  async saveSettings(nextSettings = getRuntimeSettings()) {
    const settings = setRuntimeSettings(nextSettings)
    await this.saveData(SETTINGS_STORAGE_NAME, settings)
  }

  openSetting() {
    const setting = new Setting({ width: '520px' })
    setting.addItem({
      title: (this.i18n.settingSchemaTitle as string) ?? 'Global Attribute Types',
      description: (this.i18n.settingSchemaDesc as string) ?? 'Configure attribute types and preset options globally.',
      createActionElement: () => {
        const btn = document.createElement('button')
        btn.className = 'b3-button b3-button--outline'
        btn.textContent = (this.i18n.settingSchemaManageBtn as string) ?? 'Open Manager'
        btn.addEventListener('click', () => {
          let unmount: (() => void) | undefined
          const dialog = new Dialog({
            title: (this.i18n.settingSchemaTitle as string) ?? 'Global Attribute Types',
            content: '<div class="spm-schema-dialog-host" style="height: 480px; overflow-y: auto;"></div>',
            width: '640px',
            destroyCallback: () => {
              unmount?.()
            },
          })
          const host = dialog.element.querySelector('.spm-schema-dialog-host') as HTMLElement | null
          if (host) {
            unmount = mountSchemaManager(host)
          }
        })
        return btn
      },
    })
    setting.addItem({
      title: (this.i18n.settingAttrStatsLogTitle as string) ?? 'Attribute statistics logs',
      description: (this.i18n.settingAttrStatsLogDesc as string) ?? 'Print detailed attribute statistics diagnostics in the console.',
      createActionElement: () => {
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.checked = getRuntimeSettings().enableAttrStatsDebugLog
        input.addEventListener('change', () => {
          void this.saveSettings({ enableAttrStatsDebugLog: input.checked })
        })
        return input
      },
    })
    setting.open(this.name)
  }

  toggleDockPanel() {
    const siyuanLayout = (window as any).siyuan?.layout
    const dock = siyuanLayout?.rightDock?.data?.[DOCK_TYPE]
      ? siyuanLayout.rightDock
      : siyuanLayout?.leftDock?.data?.[DOCK_TYPE]
        ? siyuanLayout.leftDock
        : siyuanLayout?.bottomDock?.data?.[DOCK_TYPE]
          ? siyuanLayout.bottomDock
          : null
    if (dock && typeof dock.toggleModel === 'function') {
      dock.toggleModel(DOCK_TYPE)
      return
    }
    const dockItem = document.querySelector<HTMLElement>(`.dock__item[data-type="${DOCK_TYPE}"]`)
    if (dockItem) {
      dockItem.click()
    }
  }
}
