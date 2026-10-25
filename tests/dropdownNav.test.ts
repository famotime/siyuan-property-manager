import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canCreateOptionValue,
  cycleIndex,
  filterOptionsByQuery,
  filterStringsByQuery,
  resolveFlatIndex,
} from '../src/utils/dropdownNav.ts'

const OPTS = [
  { label: '待办', value: 'todo' },
  { label: 'Done', value: 'done' },
]

test('cycleIndex wraps forward and backward', () => {
  assert.equal(cycleIndex(0, 3, 1), 1)
  assert.equal(cycleIndex(2, 3, 1), 0)
  assert.equal(cycleIndex(0, 3, -1), 2)
  assert.equal(cycleIndex(1, 3, -1), 0)
})

test('cycleIndex keeps index when total is 0', () => {
  assert.equal(cycleIndex(0, 0, 1), 0)
  assert.equal(cycleIndex(5, 0, -1), 5)
})

test('filterOptionsByQuery matches label and value case-insensitively', () => {
  assert.deepEqual(filterOptionsByQuery(OPTS, '待'), [OPTS[0]])
  assert.deepEqual(filterOptionsByQuery(OPTS, 'DONE'), [OPTS[1]]) // 命中 label 与 value
  assert.deepEqual(filterOptionsByQuery(OPTS, 'do'), OPTS) // 'todo' 的 value 也含 'do'
  assert.deepEqual(filterOptionsByQuery(OPTS, '  '), OPTS)
  assert.deepEqual(filterOptionsByQuery(OPTS, '不存在'), [])
})

test('filterStringsByQuery matches substring case-insensitively', () => {
  assert.deepEqual(filterStringsByQuery(['Todo', '进行中', 'done'], 'do'), ['Todo', 'done'])
  assert.deepEqual(filterStringsByQuery(['a', 'b'], ''), ['a', 'b'])
})

test('canCreateOptionValue requires non-empty query not duplicating options', () => {
  assert.equal(canCreateOptionValue(OPTS, ''), false)
  assert.equal(canCreateOptionValue(OPTS, '   '), false)
  assert.equal(canCreateOptionValue(OPTS, 'todo'), false) // 与 value 重复
  assert.equal(canCreateOptionValue(OPTS, 'Done'), false) // 与 label 重复（大小写不敏感）
  assert.equal(canCreateOptionValue(OPTS, '挂起'), true)
})

test('resolveFlatIndex maps index into option / create / history zones', () => {
  const layout = { optionCount: 2, canCreate: true, historyCount: 2 }
  assert.deepEqual(resolveFlatIndex(0, layout), { kind: 'option', index: 0 })
  assert.deepEqual(resolveFlatIndex(1, layout), { kind: 'option', index: 1 })
  assert.deepEqual(resolveFlatIndex(2, layout), { kind: 'create' })
  assert.deepEqual(resolveFlatIndex(3, layout), { kind: 'history', index: 0 })
  assert.deepEqual(resolveFlatIndex(4, layout), { kind: 'history', index: 1 })
  assert.deepEqual(resolveFlatIndex(5, layout), { kind: 'none' })
})

test('resolveFlatIndex without create zone shifts history base', () => {
  const layout = { optionCount: 1, canCreate: false, historyCount: 1 }
  assert.deepEqual(resolveFlatIndex(0, layout), { kind: 'option', index: 0 })
  assert.deepEqual(resolveFlatIndex(1, layout), { kind: 'history', index: 0 })
  assert.deepEqual(resolveFlatIndex(2, layout), { kind: 'none' })
})

test('resolveFlatIndex tolerates negative highlight', () => {
  const layout = { optionCount: 1, canCreate: false, historyCount: 0 }
  assert.deepEqual(resolveFlatIndex(-1, layout), { kind: 'none' })
})
