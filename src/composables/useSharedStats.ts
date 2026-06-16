import { sql } from '../api'
import { attrStatsDebug } from '../utils/logger'
import { normalizeSqlRows } from './attrStatsSql'

export interface DocBlockWithAttrs {
  id: string
  content: string
  type: string
  rootId: string
  attrs: { key: string, value: string }[]
}

export interface AttrStatValue {
  value: string
  count: number
}

export interface AttrStatGroup {
  name: string
  values: AttrStatValue[]
}

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\n/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

export async function runStatsSql<T extends Record<string, unknown>>(label: string, stmt: string): Promise<T[]> {
  attrStatsDebug('SQL start', { label, stmt })
  const rawRows = await sql(stmt)
  const rows = normalizeSqlRows<T>(rawRows, label)
  attrStatsDebug('SQL result', {
    label,
    rawType: rawRows === null ? 'null' : typeof rawRows,
    isArray: Array.isArray(rawRows),
    rowCount: rows.length,
    sample: rows.slice(0, 3),
  })
  return rows
}
