/**
 * SQL 字面量转义 — 全仓库唯一的单引号转义实现。
 *
 * 思源 SQL 查询层不支持参数绑定，字面量统一经此模块转义，
 * 避免 `'` → `''` 的内联实现散落各处（历史上有 4 处重复）。
 */

/** 把字符串中的每个单引号翻倍（`'` → `''`），用于拼接进 SQL 字面量前转义。 */
export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

/** 包裹成带引号的 SQL 字面量：`'it''s'`。 */
export function sqlLiteral(value: string): string {
  return `'${escapeSqlLiteral(value)}'`
}
