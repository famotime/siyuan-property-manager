import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDocBoxQuery,
  buildNotebookAttrStatsQuery,
  buildNotebookAttrTotalQuery,
  collectCustomAttrGroups,
} from '../src/composables/attrStatsSql.ts'

test('doc box query resolves notebook id from current root block', () => {
  const query = buildDocBoxQuery('doc-1')

  assert.match(query, /SELECT\s+box\s+FROM\s+blocks/i)
  assert.match(query, /WHERE\s+id\s*=\s*'doc-1'/i)
  assert.match(query, /LIMIT\s+1/i)
})

test('notebook attribute stats query filters notebook through blocks table', () => {
  const query = buildNotebookAttrStatsQuery('box-1')

  assert.match(query, /JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.block_id/i)
  assert.match(query, /b\.box\s*=\s*'box-1'/i)
  assert.doesNotMatch(query, /a\.box\s*=/i)
})

test('notebook attribute total query counts distinct blocks from same block join', () => {
  const query = buildNotebookAttrTotalQuery('box-1')

  assert.match(query, /COUNT\(DISTINCT\s+a\.block_id\)\s+AS\s+total/i)
  assert.match(query, /JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.block_id/i)
  assert.match(query, /b\.box\s*=\s*'box-1'/i)
})

test('custom attr grouping ignores names not starting with custom prefix', () => {
  const groups = collectCustomAttrGroups([
    { name: 'custom-aa', value: '1', cnt: 2 },
    { name: 'aa', value: '2', cnt: 3 },
    { name: 'custom-bb', value: '3', cnt: 1 },
    { name: 'title', value: 'doc title', cnt: 1 },
  ])

  assert.deepEqual(groups, [
    { name: 'custom-aa', values: [{ value: '1', count: 2 }] },
    { name: 'custom-bb', values: [{ value: '3', count: 1 }] },
  ])
})
