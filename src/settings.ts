import type { AvSyncMode } from '@/types/avSync'
import { DEFAULT_AV_SYNC_MODE } from '@/constants/avSync'

export interface PropertyManagerSettings {
  enableAttrStatsDebugLog: boolean
  attrStatsSortBy: 'name' | 'values' | 'blocks'
  attrStatsSortOrder: 'asc' | 'desc'
  /** 属性 ⇄ 数据库双向同步总开关。注册表为空时无任何行为。 */
  avSyncEnabled: boolean
  /** 同步方向。 */
  avSyncMode: AvSyncMode
}

export const SETTINGS_STORAGE_NAME = 'settings'

export const DEFAULT_SETTINGS: PropertyManagerSettings = {
  enableAttrStatsDebugLog: false,
  attrStatsSortBy: 'name',
  attrStatsSortOrder: 'asc',
  avSyncEnabled: true,
  avSyncMode: DEFAULT_AV_SYNC_MODE,
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

  let avSyncMode: AvSyncMode = DEFAULT_AV_SYNC_MODE
  if (source.avSyncMode === 'av-to-attr' || source.avSyncMode === 'attr-to-av') {
    avSyncMode = source.avSyncMode
  }

  return {
    enableAttrStatsDebugLog: source.enableAttrStatsDebugLog === true,
    attrStatsSortBy: sortBy,
    attrStatsSortOrder: sortOrder,
    // 缺省即为开启：注册表为空时不会产生任何同步行为，故总开关默认 true 更符合直觉
    avSyncEnabled: source.avSyncEnabled !== false,
    avSyncMode,
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
  const defaultAvSyncTitle = isEn ? 'Attribute ⇄ Database sync' : '属性 ⇄ 数据库双向同步'
  const defaultAvSyncDesc = isEn
    ? 'Bidirectional sync between custom block attributes and database (attribute view) cells. Only databases registered by this plugin participate; toggle them on the database cards.'
    : '自定义属性与数据库（属性视图）单元格双向同步。仅参与登记的数据库生效，可在数据库卡片上逐个开关。'
  const defaultAvSyncModeTitle = isEn ? 'Sync direction' : '同步方向'
  const defaultAvSyncModeDesc = isEn
    ? 'Choose which side is allowed to write to the other. Conflicts are resolved by last writer wins.'
    : '选择允许写入的方向。两侧同时变更时按到达顺序后者生效。'

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
    {
      title: i18n.settingAvSyncTitle || defaultAvSyncTitle,
      description: i18n.settingAvSyncDesc || defaultAvSyncDesc,
      direction: 'column',
      createActionElement: () => {
        const input = document.createElement('input')
        input.type = 'checkbox'
        input.className = 'b3-switch fn__flex-center'
        input.checked = getRuntimeSettings().avSyncEnabled
        input.addEventListener('change', () => {
          void host.saveSettings({ avSyncEnabled: input.checked })
        })
        return input
      },
    },
    {
      title: i18n.settingAvSyncModeTitle || defaultAvSyncModeTitle,
      description: i18n.settingAvSyncModeDesc || defaultAvSyncModeDesc,
      direction: 'column',
      createActionElement: () => {
        const select = document.createElement('select')
        select.className = 'b3-select fn__flex-center'
        const modes: Array<[AvSyncMode, string]> = [
          ['bidirectional', i18n.avSyncModeBidirectional || (isEn ? 'Bidirectional' : '双向同步')],
          ['av-to-attr', i18n.avSyncModeAvToAttr || (isEn ? 'Database → Attributes' : '数据库 → 属性')],
          ['attr-to-av', i18n.avSyncModeAttrToAv || (isEn ? 'Attributes → Database' : '属性 → 数据库')],
        ]
        const current = getRuntimeSettings().avSyncMode
        for (const [value, label] of modes) {
          const option = document.createElement('option')
          option.value = value
          option.textContent = label
          if (value === current)
            option.selected = true
          select.appendChild(option)
        }
        select.addEventListener('change', () => {
          void host.saveSettings({ avSyncMode: select.value as AvSyncMode })
        })
        return select
      },
    },
  ]
}

