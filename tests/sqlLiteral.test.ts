import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeSqlLiteral, sqlLiteral } from '../src/utils/sqlLiteral.ts'

test('escapeSqlLiteral doubles single quotes', () => {
  assert.equal(escapeSqlLiteral("it's"), "it''s")
  assert.equal(escapeSqlLiteral("'''"), "''''''")
  assert.equal(escapeSqlLiteral("o'"), "o''")
})

test('escapeSqlLiteral keeps plain strings byte-identical', () => {
  assert.equal(escapeSqlLiteral('plain'), 'plain')
  assert.equal(escapeSqlLiteral(''), '')
  assert.equal(escapeSqlLiteral('custom-status'), 'custom-status')
  assert.equal(escapeSqlLiteral('2026-11-16T10:00:00+08:00'), '2026-11-16T10:00:00+08:00')
  assert.equal(escapeSqlLiteral('中文"双引号"'), '中文"双引号"')
})

test('sqlLiteral wraps escaped value in quotes', () => {
  assert.equal(sqlLiteral("it's"), "'it''s'")
  assert.equal(sqlLiteral('a,b'), "'a,b'")
  assert.equal(sqlLiteral(''), "''")
})

test('sqlLiteral output is safe inside IN (...) list templates', () => {
  const values = ["o'brien", 'a"b', 'plain']
  const clause = values.map(v => sqlLiteral(v)).join(',')
  assert.equal(clause, `'o''brien','a"b','plain'`)
  assert.equal(
    `WHERE name IN (${clause})`,
    `WHERE name IN ('o''brien','a"b','plain')`,
  )
})
