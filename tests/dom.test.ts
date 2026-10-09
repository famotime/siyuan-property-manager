import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatTimestamp,
  isMultiline,
  parseCreatedFromId,
  resolveExternalUrl,
  shortBlockId,
} from '../src/utils/dom.ts'

// ---- formatTimestamp ----

test('formatTimestamp converts siyuan timestamp to human-readable form', () => {
  assert.equal(formatTimestamp('20260516114549'), '2026-05-16 11:45:49')
})

test('formatTimestamp returns original string when format does not match', () => {
  assert.equal(formatTimestamp('not-a-timestamp'), 'not-a-timestamp')
  assert.equal(formatTimestamp(''), '')
  assert.equal(formatTimestamp('2026051'), '2026051')
})

// ---- parseCreatedFromId ----

test('parseCreatedFromId extracts creation time from block id', () => {
  assert.equal(parseCreatedFromId('20260221084038-13s4bpr'), '2026-02-21 08:40:38')
})

test('parseCreatedFromId handles id without dash', () => {
  assert.equal(parseCreatedFromId('20260221084038'), '2026-02-21 08:40:38')
})

test('parseCreatedFromId returns empty string for invalid id', () => {
  assert.equal(parseCreatedFromId('invalid-id'), '')
  assert.equal(parseCreatedFromId(''), '')
})

// ---- shortBlockId ----

test('shortBlockId returns part after dash', () => {
  assert.equal(shortBlockId('20260221084038-13s4bpr'), '13s4bpr')
})

test('shortBlockId returns full id when no dash present', () => {
  assert.equal(shortBlockId('nodash'), 'nodash')
})

test('shortBlockId returns empty string for null/undefined/empty', () => {
  assert.equal(shortBlockId(null), '')
  assert.equal(shortBlockId(undefined), '')
  assert.equal(shortBlockId(''), '')
})

// ---- isMultiline ----

test('isMultiline returns false for empty or falsy values', () => {
  assert.equal(isMultiline(''), false)
  assert.equal(isMultiline(null as any), false)
  assert.equal(isMultiline(undefined as any), false)
})

test('isMultiline returns true for values containing newlines', () => {
  assert.equal(isMultiline('line1\nline2'), true)
})

test('isMultiline returns true for values longer than 60 characters', () => {
  assert.equal(isMultiline('a'.repeat(61)), true)
  assert.equal(isMultiline('a'.repeat(60)), false)
})

// ---- resolveExternalUrl ----

test('resolveExternalUrl keeps explicit http and https links as-is', () => {
  assert.equal(resolveExternalUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1')
  assert.equal(resolveExternalUrl('http://example.com'), 'http://example.com')
  assert.equal(resolveExternalUrl('HTTPS://Example.COM'), 'HTTPS://Example.COM')
})

test('resolveExternalUrl completes bare www links with https', () => {
  assert.equal(resolveExternalUrl('www.example.com'), 'https://www.example.com')
  assert.equal(resolveExternalUrl('  www.example.com/path  '), 'https://www.example.com/path')
})

test('resolveExternalUrl returns null for non-link values', () => {
  assert.equal(resolveExternalUrl(''), null)
  assert.equal(resolveExternalUrl('   '), null)
  assert.equal(resolveExternalUrl('just some text'), null)
  assert.equal(resolveExternalUrl('example.com'), null) // 无协议且非 www. 前缀
  assert.equal(resolveExternalUrl('ftp://example.com'), null)
  assert.equal(resolveExternalUrl('http://'), null) // 缺少主机
  assert.equal(resolveExternalUrl('www.'), null)
  assert.equal(resolveExternalUrl('see https://example.com for details'), null) // 夹在文本中不算链接
})
