import { CUSTOM_KEY_PREFIX } from '../constants/attrs.ts'
import { escapeSqlLiteral } from '../utils/sqlLiteral.ts'
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
        LIMIT 9999
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
        LIMIT 9999
      `
}

export function buildBlocksByAttrNameQuery(boxId: string, attrName: string): string {
  const box = escapeSqlLiteral(boxId)
  const name = escapeSqlLiteral(attrName)
  return `
        SELECT DISTINCT a.block_id, a.value
        FROM attributes a
        LEFT JOIN blocks b ON b.id = CASE WHEN a.root_id IS NOT NULL AND a.root_id != '' THEN a.root_id ELSE a.block_id END
        WHERE b.box = '${box}' AND a.name = '${name}'
        LIMIT 9999
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
        LIMIT 9999
      `
}

// ---- 按模板筛选与建库回填（AttrTemplateGroups / useAvDatabaseCreation） ----

export interface TemplateAttrLike {
  key?: string | null
  value?: string | null
}

/**
 * 解析模板筛选要匹配的属性键（规范为 `custom-` 前缀）。
 * 优先取「有键且（有值或模板仅一个属性）」的属性；全都不满足时回退全部属性键。
 */
export function resolveTemplateFilterKeys(attrs: TemplateAttrLike[]): string[] {
  const effective = attrs.filter(a => a.key && (a.value !== '' || attrs.length === 1))
  const source = effective.length > 0 ? effective : attrs
  return source.map((a) => {
    const k = a.key || ''
    return k.startsWith(CUSTOM_KEY_PREFIX) ? k : `${CUSTOM_KEY_PREFIX}${k}`
  })
}

export type TemplateFilterScope
  = | { kind: 'notebook', boxId: string }
    | { kind: 'doc', docId: string }

/** 按属性键集合筛选「同时拥有全部这些属性」的块（模板归类筛选面板）。 */
export function buildTemplateFilterBlocksQuery(attrKeys: string[], scope: TemplateFilterScope): string {
  const keysSql = attrKeys.map(k => `'${escapeSqlLiteral(k)}'`).join(',')
  const scopeFilter = scope.kind === 'doc'
    ? `b.root_id = '${escapeSqlLiteral(scope.docId)}'`
    : `b.box = '${escapeSqlLiteral(scope.boxId)}'`
  return `
      SELECT b.id, b.content, b.hpath, b.type
      FROM blocks AS b
      JOIN (
          SELECT block_id
          FROM attributes
          WHERE name IN (${keysSql})
          GROUP BY block_id
          HAVING count(distinct name) = ${attrKeys.length}
      ) AS t ON b.id = t.block_id
      WHERE ${scopeFilter}
      ORDER BY b.updated DESC
      LIMIT 100
    `
}

/** 建库回填：查询一组块在这些属性键上的现有值。 */
export function buildAvBackfillAttrsQuery(blockIds: string[], attrKeys: string[]): string {
  return `
      SELECT block_id, name, value FROM attributes
      WHERE block_id IN (${blockIds.map(id => `'${escapeSqlLiteral(id)}'`).join(',')})
        AND name IN (${attrKeys.map(k => `'${escapeSqlLiteral(k)}'`).join(',')})
      LIMIT 9999
    `
}
