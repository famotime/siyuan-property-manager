import test from 'node:test'
import assert from 'node:assert/strict'
import {
  inferAttrType,
  parseMultiSelectValues,
  serializeMultiSelectValues,
} from '../src/utils/typeInference.ts'

test('inferAttrType detects checkbox for boolean strings', () => {
  assert.equal(inferAttrType('custom-done', 'true'), 'checkbox')
  assert.equal(inferAttrType('custom-done', 'false'), 'checkbox')
})

test('inferAttrType detects block-ref for 22-char siyuan block ids', () => {
  assert.equal(inferAttrType('custom-target', '20230501123000-abcdef1'), 'block-ref')
})

test('inferAttrType detects date for ISO date and datetime strings', () => {
  assert.equal(inferAttrType('custom-created', '2026-09-28'), 'date')
  assert.equal(inferAttrType('custom-time', '2026-09-28 20:30'), 'date')
  assert.equal(inferAttrType('custom-time', '2026-09-28 20:30:15'), 'date')
})

test('inferAttrType detects number for numeric values', () => {
  assert.equal(inferAttrType('custom-score', '100'), 'number')
  assert.equal(inferAttrType('custom-score', '-42.5'), 'number')
})

test('inferAttrType detects multi-select for values containing commas', () => {
  assert.equal(inferAttrType('custom-labels', 'dev, test, prod'), 'multi-select')
  assert.equal(inferAttrType('custom-labels', '标签1，标签2'), 'multi-select')
})

test('inferAttrType falls back to key hints when value is empty', () => {
  assert.equal(inferAttrType('custom-deadline_date', ''), 'date')
  assert.equal(inferAttrType('custom-project_status', ''), 'select')
  assert.equal(inferAttrType('custom-blog_tags', ''), 'multi-select')
  assert.equal(inferAttrType('custom-categories', ''), 'multi-select')
  assert.equal(inferAttrType('custom-category', ''), 'select')
  assert.equal(inferAttrType('custom-view_count', ''), 'number')
  assert.equal(inferAttrType('custom-is_active', ''), 'checkbox')
  assert.equal(inferAttrType('custom-parent_ref', ''), 'block-ref')
  assert.equal(inferAttrType('custom-title', ''), 'text')
})

test('parseMultiSelectValues splits string by English and Chinese commas', () => {
  assert.deepEqual(parseMultiSelectValues('tag1, tag2, tag3'), ['tag1', 'tag2', 'tag3'])
  assert.deepEqual(parseMultiSelectValues('前端，后端， 测试 '), ['前端', '后端', '测试'])
  assert.deepEqual(parseMultiSelectValues(''), [])
  assert.deepEqual(parseMultiSelectValues('   '), [])
})

test('serializeMultiSelectValues joins array with comma and space', () => {
  assert.equal(serializeMultiSelectValues(['tag1', 'tag2']), 'tag1, tag2')
  assert.equal(serializeMultiSelectValues(['单标签']), '单标签')
  assert.equal(serializeMultiSelectValues([]), '')
})
