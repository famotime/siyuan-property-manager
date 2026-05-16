import { getFrontend, Plugin } from 'siyuan'
import '@/index.scss'
import { mountPanel, unmountPanel, usePlugin } from '@/main'

const DOCK_TYPE = 'property-manager-dock'

export default class PropertyManagerPlugin extends Plugin {
  public isMobile = false
  public platform: SyFrontendTypes = 'desktop' as SyFrontendTypes

  onload() {
    const frontEnd = getFrontend()
    this.platform = frontEnd as SyFrontendTypes
    this.isMobile = frontEnd === 'mobile' || frontEnd === 'browser-mobile'

    // 让 mountPanel 内部能取到 plugin 实例
    usePlugin(this)

    this.addDock({
      config: {
        position: 'RightTop',
        size: { width: 280, height: 0 },
        icon: 'iconList',
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
}
