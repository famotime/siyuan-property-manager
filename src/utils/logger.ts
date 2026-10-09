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

// ---- 属性 ⇄ 数据库同步 ----

const AV_SYNC_PREFIX = '[siyuan-property-manager][av-sync]'

/** 同步引擎的日志同样受「属性统计日志」开关控制，避免新增冗余设置项。 */
export function avSyncDebug(message: string, data?: unknown): void {
  if (!isAttrStatsDebugLogEnabled())
    return
  console.debug(`${AV_SYNC_PREFIX} ${message}`, data)
}

export function avSyncWarn(message: string, data?: unknown): void {
  if (!isAttrStatsDebugLogEnabled())
    return
  console.warn(`${AV_SYNC_PREFIX} ${message}`, data)
}

export function avSyncError(message: string, data?: unknown): void {
  if (!isAttrStatsDebugLogEnabled())
    return
  console.error(`${AV_SYNC_PREFIX} ${message}`, data)
}
