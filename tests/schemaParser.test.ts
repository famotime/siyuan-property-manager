import test from 'node:test'
import assert from 'node:assert/strict'
import { parseKeyAndLabel, parseOptionInputs } from '../src/utils/schemaParser.ts'

test('parseKeyAndLabel parses standard english parentheses with spaces', () => {
  const res = parseKeyAndLabel('status (状态)')
  assert.equal(res.key, 'status')
  assert.equal(res.label, '状态')
})

test('parseKeyAndLabel parses chinese fullwidth parentheses', () => {
  const res = parseKeyAndLabel('custom-status（任务状态）')
  assert.equal(res.key, 'custom-status')
  assert.equal(res.label, '任务状态')
})

test('parseKeyAndLabel parses without space before parentheses', () => {
  const res = parseKeyAndLabel('priority(优先级)')
  assert.equal(res.key, 'priority')
  assert.equal(res.label, '优先级')
})

test('parseKeyAndLabel parses with spaces inside parentheses', () => {
  const res = parseKeyAndLabel('  category (  分类标签  )  ')
  assert.equal(res.key, 'category')
  assert.equal(res.label, '分类标签')
})

test('parseKeyAndLabel parses prefix parentheses', () => {
  const res = parseKeyAndLabel('（重要程度）level')
  assert.equal(res.key, 'level')
  assert.equal(res.label, '重要程度')
})

test('parseKeyAndLabel handles empty or whitespace labels', () => {
  const res = parseKeyAndLabel('status ()')
  assert.equal(res.key, 'status')
  assert.equal(res.label, undefined)

  const resZh = parseKeyAndLabel('status（   ）')
  assert.equal(resZh.key, 'status')
  assert.equal(resZh.label, undefined)
})

test('parseKeyAndLabel handles input without parentheses', () => {
  const res = parseKeyAndLabel('custom-rating')
  assert.equal(res.key, 'custom-rating')
  assert.equal(res.label, undefined)
})

test('parseKeyAndLabel handles invalid or empty input gracefully', () => {
  assert.deepEqual(parseKeyAndLabel(''), { key: '' })
  assert.deepEqual(parseKeyAndLabel('   '), { key: '' })
  assert.deepEqual(parseKeyAndLabel(null as any), { key: '' })
})

test('parseOptionInputs splits by english and chinese commas with whitespace tolerance', () => {
  const res = parseOptionInputs('待办, 进行中，已完成, 挂起')
  assert.deepEqual(res, ['待办', '进行中', '已完成', '挂起'])
})

test('parseOptionInputs deduplicates and ignores empty segments', () => {
  const res = parseOptionInputs('P0 - 紧急,, P1 - 高 ，， P0 - 紧急, ')
  assert.deepEqual(res, ['P0 - 紧急', 'P1 - 高'])
})

test('parseOptionInputs handles single option', () => {
  const res = parseOptionInputs('  单一选项  ')
  assert.deepEqual(res, ['单一选项'])
})

test('parseOptionInputs handles commas only or empty string', () => {
  assert.deepEqual(parseOptionInputs(''), [])
  assert.deepEqual(parseOptionInputs('  , ， , '), [])
  assert.deepEqual(parseOptionInputs(null as any), [])
})
