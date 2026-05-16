import { CUSTOM_KEY_PREFIX } from '../constants/attrs.ts'

export interface AttrStatQueryRow {
  name?: string
  value?: string | null
  cnt?: number | string | null
}

export interface AttrStatQueryGroup {
  name: string
  values: { value: string, count: number }[]
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

function isCustomAttrName(name: unknown): name is string {
  return typeof name === 'string' && name.startsWith(CUSTOM_KEY_PREFIX)
}

export function collectCustomAttrGroups(rows: AttrStatQueryRow[]): AttrStatQueryGroup[] {
  const groupMap = new Map<string, { value: string, count: number }[]>()

  for (const row of rows) {
    if (!isCustomAttrName(row.name))
      continue
    const value = row.value ?? ''
    const count = Number(row.cnt ?? 0)
    if (!groupMap.has(row.name))
      groupMap.set(row.name, [])
    groupMap.get(row.name)!.push({ value, count })
  }

  const result: AttrStatQueryGroup[] = []
  for (const [name, values] of groupMap)
    result.push({ name, values })
  return result
}

export function isCustomAttrRow(row: { name?: unknown }): row is { name: string } {
  return isCustomAttrName(row.name)
}

export function buildNotebookAttrStatsQuery(boxId: string): string {
  const box = escapeSqlLiteral(boxId)
  return `
        SELECT a.name, a.value, COUNT(DISTINCT a.block_id) AS cnt
        FROM attributes a
        JOIN blocks b ON b.id = a.block_id
        WHERE b.box = '${box}' AND a.name LIKE 'custom-%'
        GROUP BY a.name, a.value
        ORDER BY a.name, cnt DESC
      `
}

export function buildDocBoxQuery(rootId: string): string {
  const id = escapeSqlLiteral(rootId)
  return `
        SELECT box FROM blocks
        WHERE id = '${id}'
        LIMIT 1
      `
}

export function buildNotebookAttrTotalQuery(boxId: string): string {
  const box = escapeSqlLiteral(boxId)
  return `
        SELECT COUNT(DISTINCT a.block_id) AS total
        FROM attributes a
        JOIN blocks b ON b.id = a.block_id
        WHERE b.box = '${box}' AND a.name LIKE 'custom-%'
      `
}
