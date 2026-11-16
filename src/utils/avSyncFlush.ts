/**
 * AV 同步冲刷的纯规划逻辑（kernel-free，有单元测试）。
 *
 * 从 `useAvSync.ts` 的 `flushCells` / `flushAttrs` 中抽出「过滤 → 预算 → 分组」
 * 三步，使冲刷的顺序语义（按到达序生效）、预算熔断与回声令牌消费可独立单测。
 * 写回（`writeIalDiffs` / `writeAvCells`）与状态归因仍留在引擎中。
 *
 * 预算语义：预算按「被采纳」的项计数；耗尽后剩余项全部进入 `overflow`，
 * 由调用方回灌待冲刷队列等待下一波（不丢弃）。
 */

import type { AvIndex } from '@/types/avSync'
import type { AttrType } from '@/types/schema'

export interface FlushCellItem {
  avID: string
  blockID: string
  keyID: string
  rowID: string
  data: any
}

/** 一条已解析、等待写回 IAL 的单元格变更。 */
export interface FlushCellWrite {
  blockID: string
  attrKey: string
  value: string
  /** 来源数据库，供状态归因；同一块可能被多个数据库绑定。 */
  avID: string
}

export interface FlushAttrItem {
  blockID: string
  avID: string
  attrKey: string
  value: string
}

/** 一条已解析、等待写回 AV 单元格的属性变更。 */
export interface FlushAvWrite {
  avID: string
  keyID: string
  itemID: string
  value: Record<string, unknown>
}

export interface FlushPlan<TWrite, TItem> {
  /** 采纳的写回项，保持入队（到达）顺序。 */
  taken: TWrite[]
  /** 预算耗尽后被搁置的原始入队项；由调用方回灌队列等待下一波。 */
  overflow: TItem[]
  /** 按 avID 统计的跳过数（未映射列 / 游离行 / 不可表达 / 回声命中等）。 */
  skippedByAv: Record<string, number>
}

function countSkip(skippedByAv: Record<string, number>, avID: string): void {
  skippedByAv[avID] = (skippedByAv[avID] ?? 0) + 1
}

/**
 * 规划一波 AV → 属性冲刷：单元格 → IAL。
 *
 * 未注册列、游离行与不可解码的项计为 skipped；预算耗尽后剩余项进入 overflow。
 */
export async function planCellFlush(
  queued: FlushCellItem[],
  deps: {
    getIndex: (avID: string) => Promise<AvIndex | null>
    /** 解码 AV 单元格值为 IAL 字符串；null 表示该变更不可同步。 */
    decode: (columnType: string, data: any) => string | null
    budget: number
  },
): Promise<FlushPlan<FlushCellWrite, FlushCellItem>> {
  const taken: FlushCellWrite[] = []
  const overflow: FlushCellItem[] = []
  const skippedByAv: Record<string, number> = {}
  let budget = deps.budget

  for (const item of queued) {
    if (budget <= 0) {
      overflow.push(item)
      continue
    }
    const index = await deps.getIndex(item.avID)
    if (!index) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    const column = index.columns.get(item.keyID)
    if (!column?.attrKey) {
      // 主键列、系统列、未映射列
      countSkip(skippedByAv, item.avID)
      continue
    }
    const blockID = index.rowToBlock.get(item.rowID)
    if (!blockID) {
      // 游离行：无回写目标
      countSkip(skippedByAv, item.avID)
      continue
    }
    const value = deps.decode(column.type, item.data)
    if (value === null) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    budget--
    taken.push({ blockID, attrKey: column.attrKey, value, avID: item.avID })
  }

  return { taken, overflow, skippedByAv }
}

/**
 * 规划一波 属性 → AV 冲刷：IAL → 单元格。
 *
 * 未启用的库、回声命中（该值正是刚从 AV 写下来的）与不可编码的项计为 skipped。
 */
export async function planAttrFlush(
  queued: FlushAttrItem[],
  deps: {
    isEnabled: (avID: string) => boolean
    /** 回声令牌：返回 true 表示该值正是刚从 AV 写下来的（消费令牌并跳过）。 */
    consumeEcho: (blockID: string, attrKey: string, value: string) => boolean
    getIndex: (avID: string) => Promise<AvIndex | null>
    resolveAttrType: (attrKey: string, value: string) => AttrType
    /** IAL 字符串编码为 AV 单元格值；null 表示不可表达。 */
    encode: (columnType: string, ialValue: string, schemaType?: AttrType) => Record<string, unknown> | null
    budget: number
  },
): Promise<FlushPlan<FlushAvWrite, FlushAttrItem>> {
  const taken: FlushAvWrite[] = []
  const overflow: FlushAttrItem[] = []
  const skippedByAv: Record<string, number> = {}
  let budget = deps.budget

  for (const item of queued) {
    if (budget <= 0) {
      overflow.push(item)
      continue
    }
    if (!deps.isEnabled(item.avID)) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    if (deps.consumeEcho(item.blockID, item.attrKey, item.value)) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    const index = await deps.getIndex(item.avID)
    if (!index) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    const column = index.byAttrKey.get(item.attrKey)
    const itemID = index.blockToRow.get(item.blockID)
    if (!column || !itemID) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    const cell = deps.encode(column.type, item.value, deps.resolveAttrType(item.attrKey, item.value))
    if (!cell) {
      countSkip(skippedByAv, item.avID)
      continue
    }
    budget--
    taken.push({ avID: item.avID, keyID: column.keyID, itemID, value: cell })
  }

  return { taken, overflow, skippedByAv }
}
