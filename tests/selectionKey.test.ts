import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSelectionKey, parseSelectionKey } from '../src/utils/selectionKey.ts'

test('makeSelectionKey/parseSelectionKey round-trips plain name and value', () => {
  const key = makeSelectionKey('custom-status', 'done')
  assert.deepEqual(parseSelectionKey(key), { name: 'custom-status', value: 'done' })
})

test('round-trips values containing spaces (multi-select joiner)', () => {
  const value = '标签一, 标签二'
  const key = makeSelectionKey('custom-labels', value)
  assert.deepEqual(parseSelectionKey(key), { name: 'custom-labels', value })
})

test('round-trips Chinese names and values', () => {
  const key = makeSelectionKey('custom-分类', '进行中')
  assert.deepEqual(parseSelectionKey(key), { name: 'custom-分类', value: '进行中' })
})

test('round-trips empty value (attribute deletion semantics)', () => {
  const key = makeSelectionKey('custom-note', '')
  assert.deepEqual(parseSelectionKey(key), { name: 'custom-note', value: '' })
})

test('round-trips value that itself contains the separator', () => {
  // 取第一个分隔符切分，值内再出现分隔符也不影响 round-trip
  const key = makeSelectionKey('custom-a', `x\u0000y`)
  assert.deepEqual(parseSelectionKey(key), { name: 'custom-a', value: 'x\u0000y' })
})

test('parseSelectionKey returns null for malformed key without separator', () => {
  // 回归：旧实现用空格拼接、按 \u0000 解析，sep 恒为 -1 导致属性名丢失末字符、
  // 属性值变成整串 key。解析失败必须显式返回 null 而不是返回错位数据。
  assert.equal(parseSelectionKey('custom-status done'), null)
  assert.equal(parseSelectionKey(''), null)
})
