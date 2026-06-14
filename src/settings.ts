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

