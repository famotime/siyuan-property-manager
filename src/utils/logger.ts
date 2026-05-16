import { isAttrStatsDebugLogEnabled } from '../settings.ts'

const ATTR_STATS_PREFIX = '[siyuan-property-manager][attr-stats]'

export function attrStatsDebug(message: string, data?: unknown): void {
  if (!isAttrStatsDebugLogEnabled())
    return
  console.debug(`${ATTR_STATS_PREFIX} ${message}`, data)
}

export function attrStatsWarn(message: string, data?: unknown): void {
  if (!isAttrStatsDebugLogEnabled())
    return
  console.warn(`${ATTR_STATS_PREFIX} ${message}`, data)
}

export function attrStatsError(message: string, data?: unknown): void {
  if (!isAttrStatsDebugLogEnabled())
    return
  console.error(`${ATTR_STATS_PREFIX} ${message}`, data)
}
