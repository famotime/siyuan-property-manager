import { getFrontend, Plugin, Setting } from 'siyuan'
import '@/index.scss'
import { mountPanel, unmountPanel, usePlugin } from '@/main'
import { getRuntimeSettings, normalizeSettings, SETTINGS_STORAGE_NAME, setRuntimeSettings } from '@/settings'

const DOCK_TYPE = 'property-manager-dock'

const ICON_SVG = '<symbol id="iconPropertyManager" viewBox="0 0 48 48"><path d="M32.9037 13.9272C31.2464 17.1588 27.8814 19.3702 24 19.3702C20.1185 19.3702 16.7536 17.1588 15.0963 13.9272C11.3982 16.6591 9 21.0495 9 26.0001C9 26.8178 9.06543 27.6202 9.19135 28.4024C9.45807 28.3811 9.72775 28.3702 9.99996 28.3702C15.5228 28.3702 20 32.8474 20 38.3702C20 39.0665 19.9288 39.7461 19.7934 40.4022C21.128 40.7914 22.5397 41.0001 24 41.0001C25.4603 41.0001 26.8719 40.7914 28.2066 40.4022C28.0711 39.7461 28 39.0665 28 38.3702C28 32.8474 32.4771 28.3702 38 28.3702C38.2722 28.3702 38.5419 28.3811 38.8087 28.4024C38.9346 27.6202 39 26.8178 39 26.0001C39 21.0495 36.6017 16.6591 32.9037 13.9272Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M24 13C26.2091 13 28 11.2091 28 9C28 6.79086 26.2091 5 24 5C21.7909 5 20 6.79086 20 9C20 11.2091 21.7909 13 24 13Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M9 43C11.2091 43 13 41.2091 13 39C13 36.7909 11.2091 35 9 35C6.79086 35 5 36.7909 5 39C5 41.2091 6.79086 43 9 43Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M39 43C41.2091 43 43 41.2091 43 39C43 36.7909 41.2091 35 39 35C36.7909 35 35 36.7909 35 39C35 41.2091 36.7909 43 39 43Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></symbol>'

export default class PropertyManagerPlugin extends Plugin {
  public isMobile = false
  public platform: SyFrontendTypes = 'desktop' as SyFrontendTypes

  async onload() {
    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === 'mobile' || frontEnd === 'browser-mobile'

    this.addIcons(ICON_SVG)

    // 让 mountPanel 内部能取到 plugin 实例
    usePlugin(this)
    await this.loadSettings()

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
  }

  onunload() {
    // dock 关闭时 petal 会自动调用 destroy 回调，这里无需手工卸载组件。
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
}
