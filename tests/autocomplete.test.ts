import test from 'node:test'
import assert from 'node:assert/strict'
import {
  _setAutocompleteCacheForTest,
  matchQuery,
  registerCustomKey,
  suggestCustomKeys,
  suggestCustomValues,
} from '../src/utils/autocomplete.ts'

test('matchQuery matches exact, prefix, substring, and pinyin', () => {
  assert.equal(matchQuery('status', 'status').matched, true)
  assert.equal(matchQuery('status', 'sta').matched, true)
  assert.equal(matchQuery('project_status', 'stat').matched, true)
  assert.equal(matchQuery('进行中', 'jxz').matched, true)
  assert.equal(matchQuery('状态', 'zt').matched, true)
  assert.equal(matchQuery('abc', 'xyz').matched, false)
})

test('suggestCustomKeys returns ranked matching keys from cache', () => {
  _setAutocompleteCacheForTest(['status', 'state', 'stage', 'priority', 'tags'])

  const results = suggestCustomKeys('sta')
  assert.deepEqual(results, ['stage', 'state', 'status'])

  registerCustomKey('custom-star')
  const updated = suggestCustomKeys('star')
  assert.deepEqual(updated, ['star'])
})

test('suggestCustomValues returns matching cached values', async () => {
  _setAutocompleteCacheForTest([], {
    'custom-status': ['In Progress', 'Done', 'Todo', 'Pending'],
  })

  const results = await suggestCustomValues('status', 'in')
  assert.deepEqual(results, ['In Progress', 'Pending'])
})
