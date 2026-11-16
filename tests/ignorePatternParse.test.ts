import test from 'node:test'
import assert from 'node:assert/strict'
import { parseIgnorePatternLines } from '../src/utils/attrStatsFilter'
import { escapeHtml } from '../src/utils/dom'

// ---- parseIgnorePatternLines（RF-111：从 NotebookAttrStats 对话框下沉的纯逻辑） ----

test('parseIgnorePatternLines collects trimmed valid patterns and skips blanks/comments', () => {
  const res = parseIgnorePatternLines([
    '^dailynote-.*',
    '   ',
    '# 注释行',
    '  custom-temp_.*  ',
    '',
  ])
  assert.deepEqual(res.validPatterns, ['^dailynote-.*', 'custom-temp_.*'])
  assert.equal(res.error, null)
})

test('parseIgnorePatternLines reports the first syntax error with 1-based line number', () => {
  const res = parseIgnorePatternLines([
    '^ok-.*',
    '(invalid[regex',
    'also(bad',
  ])
  assert.deepEqual(res.validPatterns, ['^ok-.*'])
  assert.equal(res.error?.line, 2)
  assert.ok(typeof res.error?.message === 'string' && res.error.message.length > 0)
})

test('parseIgnorePatternLines keeps collecting valid patterns after an error', () => {
  const res = parseIgnorePatternLines([
    '(bad',
    '^good-.*',
  ])
  assert.deepEqual(res.validPatterns, ['^good-.*'])
  assert.equal(res.error?.line, 1)
})

test('parseIgnorePatternLines returns empty result for empty input', () => {
  assert.deepEqual(parseIgnorePatternLines([]), { validPatterns: [], error: null })
  assert.deepEqual(parseIgnorePatternLines(['', '   ', '# only comment']), { validPatterns: [], error: null })
})

// ---- escapeHtml（自 NotebookAttrStats.vue 下沉至 utils/dom） ----

test('escapeHtml escapes all five HTML entities', () => {
  assert.equal(escapeHtml('<a href="x">it\'s</a>'), '&lt;a href=&quot;x&quot;&gt;it&#39;s&lt;/a&gt;')
  assert.equal(escapeHtml('A & B'), 'A &amp; B')
  assert.equal(escapeHtml('plain'), 'plain')
  assert.equal(escapeHtml(''), '')
})
