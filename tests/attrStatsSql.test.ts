import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBlocksByAttrValueQuery,
  buildBlocksInfoByAttrValueQuery,
  buildDocBlockByAttrIdQuery,
  buildDocBlockByIalIdQuery,
  buildDocBoxQuery,
  buildNotebookAttrStatsQuery,
  buildNotebookAttrTotalQuery,
  collectCustomAttrGroups,
  extractDocCustomId,
  mergeCurrentDocAttrRows,
  normalizeSqlRows,
  selectStatsSeedId,
} from '../src/composables/attrStatsSql.ts'

test('doc box query resolves notebook id from current root block', () => {
  const query = buildDocBoxQuery('doc-1')

  assert.match(query, /SELECT\s+box\s+FROM\s+blocks/i)
  assert.match(query, /WHERE\s+id\s*=\s*'doc-1'/i)
  assert.match(query, /LIMIT\s+1/i)
})

test('doc block ial query resolves real document block from visible doc id', () => {
  const query = buildDocBlockByIalIdQuery('20250618234728-oh7elgq')

  assert.match(query, /SELECT\s+id,\s*root_id,\s*box\s+FROM\s+blocks/i)
  assert.match(query, /ial\s+LIKE\s+'%id="20250618234728-oh7elgq"%'/i)
  assert.match(query, /LIMIT\s+1/i)
})

test('doc block attribute query resolves document root from attribute-only id', () => {
  const query = buildDocBlockByAttrIdQuery('20250618234728-oh7elgq')

  assert.match(query, /SELECT\s+root_id,\s*block_id\s+FROM\s+attributes/i)
  assert.match(query, /block_id\s*=\s*'20250618234728-oh7elgq'/i)
  assert.match(query, /root_id\s*=\s*'20250618234728-oh7elgq'/i)
  assert.match(query, /name\s+LIKE\s+'custom-%'/i)
})

test('notebook attribute stats query filters notebook through blocks table', () => {
  const query = buildNotebookAttrStatsQuery('box-1')

  assert.match(query, /JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.root_id/i)
  assert.match(query, /b\.box\s*=\s*'box-1'/i)
  assert.doesNotMatch(query, /a\.box\s*=/i)
})

test('notebook attribute stats query can include current document root outside notebook box', () => {
  const query = buildNotebookAttrStatsQuery('box-1', ['doc-root-1'])

  assert.match(query, /LEFT\s+JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.root_id/i)
  assert.match(query, /\(b\.box\s*=\s*'box-1'\s+OR\s+a\.root_id\s+IN\s*\('doc-root-1'\)\)/i)
})

test('notebook attribute total query counts distinct blocks from same block join', () => {
  const query = buildNotebookAttrTotalQuery('box-1')

  assert.match(query, /COUNT\(DISTINCT\s+a\.block_id\)\s+AS\s+total/i)
  assert.match(query, /JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.root_id/i)
  assert.match(query, /b\.box\s*=\s*'box-1'/i)
})

test('notebook attribute total query can include current document root outside notebook box', () => {
  const query = buildNotebookAttrTotalQuery('box-1', ['doc-root-1'])

  assert.match(query, /LEFT\s+JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.root_id/i)
  assert.match(query, /\(b\.box\s*=\s*'box-1'\s+OR\s+a\.root_id\s+IN\s*\('doc-root-1'\)\)/i)
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

test('merges current document custom attrs missing from notebook stats rows', () => {
  const rows = mergeCurrentDocAttrRows(
    [{ name: 'custom-category', value: 'A', cnt: 2 }],
    [
      { key: 'custom-category', value: 'A' },
      { key: 'custom-keywords', value: '<nil>' },
      { key: 'title', value: 'Doc title' },
    ],
  )

  assert.deepEqual(rows, [
    { name: 'custom-category', value: 'A', cnt: 2 },
    { name: 'custom-keywords', value: '<nil>', cnt: 1 },
  ])
})

test('extracts real doc id from migrated document ial custom-id', () => {
  const kramdown = `content

{: custom-category="/知识点滴/生活娱乐/" custom-id="20250618234728-elk0cnq" id="20250618234728-oh7elgq" type="doc"}`

  assert.equal(extractDocCustomId(kramdown), '20250618234728-elk0cnq')
})

test('extract doc custom id ignores missing or invalid custom-id', () => {
  assert.equal(extractDocCustomId('{: id="20250618234728-oh7elgq" type="doc"}'), null)
  assert.equal(extractDocCustomId('{: custom-id="not-a-block-id" id="20250618234728-oh7elgq"}'), null)
})

test('blocks by attr value query filters by box, name and value', () => {
  const query = buildBlocksByAttrValueQuery('box-1', 'custom-status', '进行中')

  assert.match(query, /SELECT\s+DISTINCT\s+a\.block_id/i)
  assert.match(query, /JOIN\s+blocks\s+b\s+ON\s+b\.id\s*=\s*a\.root_id/i)
  assert.match(query, /b\.box\s*=\s*'box-1'/i)
  assert.match(query, /a\.name\s*=\s*'custom-status'/i)
  assert.match(query, /a\.value\s*=\s*'进行中'/i)
})

test('blocks by attr value query escapes SQL literals', () => {
  const query = buildBlocksByAttrValueQuery("box'1", "custom-it's", "val'ue")

  assert.match(query, /b\.box\s*=\s*'box''1'/i)
  assert.match(query, /a\.name\s*=\s*'custom-it''s'/i)
  assert.match(query, /a\.value\s*=\s*'val''ue'/i)
})

test('stats seed id prefers current block id over possibly stale root id', () => {
  assert.equal(selectStatsSeedId('old-root', 'current-block'), 'current-block')
  assert.equal(selectStatsSeedId('root-only', null), 'root-only')
  assert.equal(selectStatsSeedId(null, 'block-only'), 'block-only')
  assert.equal(selectStatsSeedId(null, null), null)
})

test('normalizes non-array sql results to an empty row list', () => {
  assert.deepEqual(normalizeSqlRows([{ id: 'row-1' }], 'stats'), [{ id: 'row-1' }])
  assert.deepEqual(normalizeSqlRows(null, 'stats'), [])
  assert.deepEqual(normalizeSqlRows({ id: 'not-array' }, 'stats'), [])
})

test('buildBlocksInfoByAttrValueQuery generates correct sql and escapes characters', () => {
  const query = buildBlocksInfoByAttrValueQuery("box'1", "custom-it's", "val'ue")

  assert.match(query, /SELECT\s+DISTINCT\s+a\.block_id\s+AS\s+id/i)
  assert.match(query, /b_root\.box\s*=\s*'box''1'/i)
  assert.match(query, /a\.name\s*=\s*'custom-it''s'/i)
  assert.match(query, /a\.value\s*=\s*'val''ue'/i)
})
