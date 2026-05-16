export interface PropertyManagerSettings {
  enableAttrStatsDebugLog: boolean
}

export const SETTINGS_STORAGE_NAME = 'settings'

export const DEFAULT_SETTINGS: PropertyManagerSettings = {
  enableAttrStatsDebugLog: false,
}

let runtimeSettings: PropertyManagerSettings = { ...DEFAULT_SETTINGS }

export function normalizeSettings(value: unknown): PropertyManagerSettings {
  if (!value || typeof value !== 'object')
    return { ...DEFAULT_SETTINGS }

  const source = value as Partial<PropertyManagerSettings>
  return {
    enableAttrStatsDebugLog: source.enableAttrStatsDebugLog === true,
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
