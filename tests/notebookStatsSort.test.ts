import test from 'node:test'
import assert from 'node:assert/strict'
import { sortAttrGroups, getGroupBlockCount } from '../src/utils/notebookStatsSort.ts'

test('getGroupBlockCount calculates sum of values correctly', () => {
  const count = getGroupBlockCount({
    name: 'test',
    values: [
      { value: 'A', count: 1 },
      { value: 'B', count: 5 }
    ]
  })
  assert.equal(count, 6)
})

test('sortAttrGroups by name asc', () => {
  const groups = [
    { name: 'C', values: [] },
    { name: 'A', values: [] },
    { name: 'B', values: [] },
  ]
  const sorted = sortAttrGroups(groups, 'name', 'asc')
  assert.equal(sorted[0].name, 'A')
  assert.equal(sorted[1].name, 'B')
  assert.equal(sorted[2].name, 'C')
})

test('sortAttrGroups by values count desc', () => {
  const groups = [
    { name: 'A', values: [{ value: 'v1', count: 1 }] },
    { name: 'B', values: [{ value: 'v1', count: 1 }, { value: 'v2', count: 1 }, { value: 'v3', count: 1 }] },
    { name: 'C', values: [{ value: 'v1', count: 1 }, { value: 'v2', count: 1 }] },
  ]
  const sorted = sortAttrGroups(groups, 'values', 'desc')
  assert.equal(sorted[0].name, 'B')
  assert.equal(sorted[1].name, 'C')
  assert.equal(sorted[2].name, 'A')
})

test('sortAttrGroups by blocks count asc', () => {
  const groups = [
    { name: 'A', values: [{ value: 'v1', count: 10 }] }, // 10 blocks
    { name: 'B', values: [{ value: 'v1', count: 1 }, { value: 'v2', count: 2 }] }, // 3 blocks
    { name: 'C', values: [{ value: 'v1', count: 5 }, { value: 'v2', count: 1 }] }, // 6 blocks
  ]
  const sorted = sortAttrGroups(groups, 'blocks', 'asc')
  assert.equal(sorted[0].name, 'B')
  assert.equal(sorted[1].name, 'C')
  assert.equal(sorted[2].name, 'A')
})
