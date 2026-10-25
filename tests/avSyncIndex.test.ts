import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAvIndexFromView, dropAvIndexRows, seedAvIndexFromSrcs } from '../src/utils/avSyncIndex.ts'
import type { AvSyncRegistryEntry } from '../src/types/avSync.d.ts'

function makeEntry(mapping: Record<string, string> = {}): AvSyncRegistryEntry {
  return { avID: 'av-1', name: '测试库', enabled: true, mapping, updatedAt: 0 }
}

/** 仿 `renderAttributeView` 响应的最小载荷（结构见 `kernel/av/value.go` 的 Value）。 */
function makeRenderData(overrides: {
  columns?: any[]
  rows?: any[]
} = {}) {
  return {
    view: {
      columns: overrides.columns ?? [
        { id: 'col-block', name: '块', type: 'block' },
        { id: 'col-status', name: 'custom-status', type: 'select' },
        { id: 'col-note', name: '备注', type: 'text' },
      ],
      rows: overrides.rows ?? [
        {
          id: 'row-1',
          cells: [
            { value: { block: { id: '20260101120000-abcdef1' } } },
            { value: { mSelect: [{ content: 'done' }] } },
            { value: { text: { content: 'n1' } } },
          ],
        },
        {
          id: 'row-2',
          cells: [
            { value: { block: { id: '20260101120000-abcdef2' }, isDetached: true } },
            { value: { mSelect: [] } },
            { value: { text: { content: 'n2' } } },
          ],
        },
      ],
    },
  }
}

test('registry mapping wins over column-name inference', () => {
  const entry = makeEntry({ 'col-status': 'custom-state' })
  const { index, derived } = buildAvIndexFromView('av-1', entry, makeRenderData())
  assert.equal(index.columns.get('col-status')?.attrKey, 'custom-state')
  assert.deepEqual(derived, {})
})

test('column name itself falls back to attrKey and is reported as derived', () => {
  const { index, derived } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  assert.equal(index.columns.get('col-status')?.attrKey, 'custom-status')
  assert.deepEqual(derived, { 'col-status': 'custom-status' })
})

test('non-syncable column names map to null attrKey', () => {
  const { index, derived } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  // '备注'（非 custom-）与主键列 'col-block' 均不参与值同步
  assert.equal(index.columns.get('col-note')?.attrKey, null)
  assert.equal(index.columns.get('col-block')?.attrKey, null)
  assert.deepEqual(derived, { 'col-status': 'custom-status' })
})

test('registry mapping with unsyncable value falls back to name inference', () => {
  const entry = makeEntry({ 'col-status': 'custom-avs' }) // 保留键不可同步
  const { index, derived } = buildAvIndexFromView('av-1', entry, makeRenderData())
  assert.equal(index.columns.get('col-status')?.attrKey, 'custom-status')
  assert.deepEqual(derived, { 'col-status': 'custom-status' })
})

test('first column wins in byAttrKey when two columns map to the same attrKey', () => {
  const data = makeRenderData({
    columns: [
      { id: 'col-a', name: 'custom-tag', type: 'text' },
      { id: 'col-b', name: 'custom-tag', type: 'text' },
    ],
    rows: [],
  })
  const { index } = buildAvIndexFromView('av-1', makeEntry(), data)
  assert.equal(index.byAttrKey.get('custom-tag')?.keyID, 'col-a')
})

test('block column detection and row binding', () => {
  const { index } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  assert.equal(index.blockKeyID, 'col-block')
  // 绑定行：双向映射
  assert.equal(index.rowToBlock.get('row-1'), '20260101120000-abcdef1')
  assert.equal(index.blockToRow.get('20260101120000-abcdef1'), 'row-1')
  // 主键列 isDetached 的行进游离集合
  assert.equal(index.rowToBlock.has('row-2'), false)
  assert.equal(index.detachedRowIds.has('row-2'), true)
})

test('rows keep cells cached regardless of binding', () => {
  const { index } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  assert.equal(index.rowCells.size, 2)
  assert.equal(index.rowCells.get('row-2')?.length, 3)
})

test('payload without block column marks every row detached', () => {
  const data = makeRenderData({
    columns: [{ id: 'col-status', name: 'custom-status', type: 'select' }],
    rows: [{ id: 'row-1', cells: [{ value: {} }] }],
  })
  const { index } = buildAvIndexFromView('av-1', makeEntry(), data)
  assert.equal(index.blockKeyID, null)
  assert.equal(index.detachedRowIds.has('row-1'), true)
  assert.equal(index.rowToBlock.size, 0)
})

test('row with empty block id is detached', () => {
  const data = makeRenderData({
    rows: [{
      id: 'row-x',
      cells: [{ value: { block: {} } }],
    }],
  })
  const { index } = buildAvIndexFromView('av-1', makeEntry(), data)
  assert.equal(index.detachedRowIds.has('row-x'), true)
})

test('columns without id and rows without id are skipped; missing type defaults to text', () => {
  const data = makeRenderData({
    columns: [
      { id: '', name: 'no-id', type: 'text' },
      { name: 'custom-anon', type: 'text' },
      { id: 'col-x', name: 'custom-x' },
    ],
    rows: [{ cells: [] }, { id: 'row-1', cells: [] }],
  })
  const { index } = buildAvIndexFromView('av-1', makeEntry(), data)
  assert.equal(index.columns.size, 1)
  assert.equal(index.columns.get('col-x')?.type, 'text')
  assert.equal(index.rowCells.size, 1)
})

test('non-object view data yields an empty index', () => {
  const { index } = buildAvIndexFromView('av-1', makeEntry(), {})
  assert.equal(index.columns.size, 0)
  assert.equal(index.rowToBlock.size, 0)
})

test('seedAvIndexFromSrcs binds attached srcs and detaches detached ones', () => {
  const { index } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  seedAvIndexFromSrcs(index, [
    { itemID: 'row-3', id: '20260101120000-abcdef3' },
    { itemID: 'row-4' }, // 无块 ID 视为游离
  ])
  assert.equal(index.rowToBlock.get('row-3'), '20260101120000-abcdef3')
  assert.equal(index.blockToRow.get('20260101120000-abcdef3'), 'row-3')
  assert.equal(index.detachedRowIds.has('row-3'), false)
  assert.equal(index.detachedRowIds.has('row-4'), true)
})

test('seedAvIndexFromSrcs detach path keeps existing binding (pinned asymmetry)', () => {
  // 钉住现状：游离 src 只入游离集合，不清除既有双向映射（绑定方向才清理）。
  // 实践中 rows-insert 只带新行；既有行的绑定变化走结构性 op → markStale → 全量重建。
  const { index } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  seedAvIndexFromSrcs(index, [{ itemID: 'row-1', isDetached: true }])
  assert.equal(index.rowToBlock.get('row-1'), '20260101120000-abcdef1')
  assert.equal(index.detachedRowIds.has('row-1'), true)
})

test('dropAvIndexRows cleans bidirectional mapping and cell cache', () => {
  const { index } = buildAvIndexFromView('av-1', makeEntry(), makeRenderData())
  dropAvIndexRows(index, ['row-1', 'row-2'])
  assert.equal(index.rowToBlock.size, 0)
  assert.equal(index.blockToRow.size, 0)
  assert.equal(index.detachedRowIds.size, 0)
  assert.equal(index.rowCells.size, 0)
})
