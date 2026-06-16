import { CUSTOM_KEY_PREFIX } from '../constants/attrs.ts'
import { attrStatsWarn } from '../utils/logger.ts'

export interface AttrStatQueryRow {
  name?: string
  value?: string | null
  cnt?: number | string | null
}

export interface DocCustomAttrRow {
  key?: string
  value?: string | null
}

export interface AttrStatQueryGroup {
  name: string
  values: { value: string, count: number }[]
}

export type SqlRow = Record<string, unknown>

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

function isCustomAttrName(name: unknown): name is string {
  return typeof name === 'string' && name.startsWith(CUSTOM_KEY_PREFIX)
}

function buildRootIdInClause(rootIds: string[]): string {
  const ids = [...new Set(rootIds.filter(Boolean))]
  if (ids.length === 0)
    return ''
  return ` OR a.root_id IN (${ids.map(id => `'${escapeSqlLiteral(id)}'`).join(',')})`
}

export function extractDocCustomId(kramdown: string): string | null {
  const match = kramdown.match(/\bcustom-id="([0-9]{14}-[a-z0-9]{7})"/)
  return match?.[1] ?? null
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

export function mergeCurrentDocAttrRows(rows: AttrStatQueryRow[], docAttrs: DocCustomAttrRow[]): AttrStatQueryRow[] {
  const merged = [...rows]
  const seen = new Set(
    rows
      .filter(row => isCustomAttrName(row.name))
      .map(row => `${row.name}\u0000${row.value ?? ''}`),
  )

  for (const attr of docAttrs) {
    if (!isCustomAttrName(attr.key))
      continue
    const value = attr.value ?? ''
    const key = `${attr.key}\u0000${value}`
    if (seen.has(key))
      continue
    seen.add(key)
    merged.push({ name: attr.key, value, cnt: 1 })
  }

  return merged
}

export function isCustomAttrRow(row: { block_id?: unknown, name?: unknown, value?: unknown }): row is { block_id: string, name: string, value?: string | null } {
  return isCustomAttrName(row.name)
}

export function selectStatsSeedId(rootId?: string | null, blockId?: string | null): string | null {
  return blockId ?? rootId ?? null
}

export function normalizeSqlRows<T extends SqlRow>(value: unknown, label: string): T[] {
  if (Array.isArray(value))
    return value as T[]

  attrStatsWarn('SQL returned non-array rows', {
    label,
    type: value === null ? 'null' : typeof value,
    value,
  })
  return []
}

export function buildNotebookAttrStatsQuery(boxId: string, extraRootIds: string[] = []): string {
  const box = escapeSqlLiteral(boxId)
  const extraRootFilter = buildRootIdInClause(extraRootIds)
  return `
        SELECT a.name, a.value, COUNT(DISTINCT a.block_id) AS cnt
        FROM attributes a
        LEFT JOIN blocks b ON b.id = CASE WHEN a.root_id IS NOT NULL AND a.root_id != '' THEN a.root_id ELSE a.block_id END
        WHERE (b.box = '${box}'${extraRootFilter}) AND a.name LIKE 'custom-%'
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

export function buildDocBlockByIalIdQuery(id: string): string {
  const escapedId = escapeSqlLiteral(id)
  return `
        SELECT id, root_id, box FROM blocks
        WHERE ial LIKE '%id="${escapedId}"%'
        ORDER BY type = 'd' DESC
        LIMIT 1
      `
}

export function buildDocBlockByAttrIdQuery(id: string): string {
  const escapedId = escapeSqlLiteral(id)
  return `
        SELECT root_id, block_id FROM attributes
        WHERE (block_id = '${escapedId}' OR root_id = '${escapedId}') AND name LIKE 'custom-%'
        LIMIT 1
      `
}

export function buildBlocksByAttrValueQuery(boxId: string, attrName: string, attrValue: string): string {
  const box = escapeSqlLiteral(boxId)
  const name = escapeSqlLiteral(attrName)
  const value = escapeSqlLiteral(attrValue)
  return `
        SELECT DISTINCT a.block_id
        FROM attributes a
        LEFT JOIN blocks b ON b.id = CASE WHEN a.root_id IS NOT NULL AND a.root_id != '' THEN a.root_id ELSE a.block_id END
        WHERE b.box = '${box}' AND a.name = '${name}' AND a.value = '${value}'
      `
}

export function buildNotebookAttrTotalQuery(boxId: string, extraRootIds: string[] = []): string {
  const box = escapeSqlLiteral(boxId)
  const extraRootFilter = buildRootIdInClause(extraRootIds)
  return `
        SELECT COUNT(DISTINCT a.block_id) AS total
        FROM attributes a
        LEFT JOIN blocks b ON b.id = CASE WHEN a.root_id IS NOT NULL AND a.root_id != '' THEN a.root_id ELSE a.block_id END
        WHERE (b.box = '${box}'${extraRootFilter}) AND a.name LIKE 'custom-%'
      `
}

export function buildBlocksInfoByAttrValueQuery(boxId: string, attrName: string, attrValue: string): string {
  const box = escapeSqlLiteral(boxId)
  const name = escapeSqlLiteral(attrName)
  const value = escapeSqlLiteral(attrValue)
  return `
        SELECT DISTINCT a.block_id AS id, b_target.root_id, b_target.hpath, b_target.content, b_target.type
        FROM attributes a
        LEFT JOIN blocks b_root ON b_root.id = CASE WHEN a.root_id IS NOT NULL AND a.root_id != '' THEN a.root_id ELSE a.block_id END
        LEFT JOIN blocks b_target ON b_target.id = a.block_id
        WHERE b_root.box = '${box}' AND a.name = '${name}' AND a.value = '${value}'
      `
}
