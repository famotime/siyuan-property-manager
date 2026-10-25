import test from 'node:test'
import assert from 'node:assert/strict'
import { collectChangedBlockIds } from '../src/utils/wsMainEvents.ts'

test('collects block ids from op.id and op.blockID across transactions', () => {
  const ids = collectChangedBlockIds([
    { doOperations: [{ id: 'b1' }, { blockID: 'b2' }] },
    { doOperations: [{ id: 'b1' }, { id: 'b3', blockID: 'ignored-when-id-present' }] },
  ])
  assert.deepEqual([...ids].sort(), ['b1', 'b2', 'b3'])
})

test('skips null transactions, non-array doOperations and empty ops', () => {
  const ids = collectChangedBlockIds([
    null,
    { doOperations: 'not-an-array' },
    { doOperations: [null, {}, { id: '' }, { blockID: undefined }] },
    { undoOperations: [{ id: 'undo-only' }] },
  ])
  assert.equal(ids.size, 0)
})

test('returns empty set for empty input', () => {
  assert.equal(collectChangedBlockIds([]).size, 0)
})
