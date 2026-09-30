export interface PropertyManagerSettings {
  enableAttrStatsDebugLog: boolean
  attrStatsSortBy: 'name' | 'values' | 'blocks'
  attrStatsSortOrder: 'asc' | 'desc'
}

export const SETTINGS_STORAGE_NAME = 'settings'

export const DEFAULT_SETTINGS: PropertyManagerSettings = {
  enableAttrStatsDebugLog: false,
  attrStatsSortBy: 'name',
  attrStatsSortOrder: 'asc',
}

let runtimeSettings: PropertyManagerSettings = { ...DEFAULT_SETTINGS }

export function normalizeSettings(value: unknown): PropertyManagerSettings {
  if (!value || typeof value !== 'object')
    return { ...DEFAULT_SETTINGS }

  const source = value as Partial<PropertyManagerSettings>

  let sortBy: 'name' | 'values' | 'blocks' = 'name'
  if (source.attrStatsSortBy === 'values' || source.attrStatsSortBy === 'blocks') {
    sortBy = source.attrStatsSortBy
  }

  let sortOrder: 'asc' | 'desc' = 'asc'
  if (source.attrStatsSortOrder === 'desc') {
    sortOrder = 'desc'
  }

  return {
    enableAttrStatsDebugLog: source.enableAttrStatsDebugLog === true,
    attrStatsSortBy: sortBy,
    attrStatsSortOrder: sortOrder,
  }
}

export function getRuntimeSettings(): PropertyManagerSettings {
  return { ...runtimeSettings }
}

export function setRuntimeSettings(settings: Partial<PropertyManagerSettings> | unknown): PropertyManagerSettings {
  runtimeSettings = normalizeSettings({
    ...runtimeSettings,
    ...(settings && typeof settings === 'object' ? settings : {}),
  })
  return getRuntimeSettings()
}

export function isAttrStatsDebugLogEnabled(): boolean {
  return runtimeSettings.enableAttrStatsDebugLog
}

export interface SettingItemDescriptor {
  title: string
  description?: string
  direction?: 'row' | 'column'
  createActionElement: () => HTMLElement
}

export interface PropertyManagerSettingHost {
  i18n?: Record<string, string>
  isMobile?: boolean
  displayName?: string
  name?: string
  openSchemaManager: () => void
  saveSettings: (settings: Partial<PropertyManagerSettings>) => Promise<void> | void
}

export function createSettingItemDescriptors(host: PropertyManagerSettingHost): SettingItemDescriptor[] {
  const i18n = host.i18n || {}
  const isEn = Boolean(i18n.settingSchemaTitle?.includes('Global'))
  const defaultSchemaTitle = isEn ? 'Global Attribute Types' : '全局属性类型管理'
  const defaultSchemaDesc = isEn ? 'Configure attribute types and preset options globally.' : '集中配置自定义属性的数据类型与选项池。'
  const defaultManageBtn = isEn ? 'Open Manager' : '打开管理面板'
  const defaultStatsLogTitle = isEn ? 'Attribute statistics logs' : '属性统计日志'
  const defaultStatsLogDesc = isEn ? 'Print detailed attribute statistics diagnostics in the console.' : '开启后在开发者工具 Console 输出属性统计诊断日志，默认关闭。'

  return [
    {
      title: i18n.settingSchemaTitle || defaultSchemaTitle,
      description: i18n.settingSchemaDesc || defaultSchemaDesc,
      direction: 'column',
      createActionElement: () => {
        const btn = document.createElement('button')
        btn.className = 'b3-button b3-button--outline'
        btn.textContent = i18n.settingSchemaManageBtn || defaultManageBtn
        btn.style.setProperty('width', 'auto', 'important')
        btn.style.setProperty('max-width', '130px', 'important')
        btn.style.setProperty('flex-shrink', '0', 'important')
        btn.style.setProperty('white-space', 'nowrap', 'important')
        btn.style.setProperty('box-sizing', 'border-box', 'important')
        btn.addEventListener('click', () => {
          host.openSchemaManager()
        })
        return btn
      },
    },
    {
      title: i18n.settingAttrStatsLogTitle || defaultStatsLogTitle,
      description: i18n.settingAttrStatsLogDesc || defaultStatsLogDesc,
      direction: 'column',
      createActionElement: () => {
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.className = 'b3-switch fn__flex-center'
        input.checked = getRuntimeSettings().enableAttrStatsDebugLog
        input.addEventListener('change', () => {
          void host.saveSettings({ enableAttrStatsDebugLog: input.checked })
        })
        return input
      },
    },
  ]
}

