import test from 'node:test'
import assert from 'node:assert/strict'
import { nextCurrentBlockState } from '../src/utils/currentBlockState.ts'

test('document title fallback updates current root id with selected document id', () => {
  const state = nextCurrentBlockState(
    { blockId: 'old-doc', blockKind: 'doc', rootId: 'old-doc' },
    { id: 'new-doc', kind: 'doc' },
  )

  assert.deepEqual(state, {
    blockId: 'new-doc',
    blockKind: 'doc',
    rootId: 'new-doc',
  })
})

test('block selection keeps existing current root id', () => {
  const state = nextCurrentBlockState(
    { blockId: 'old-block', blockKind: 'block', rootId: 'doc-1' },
    { id: 'block-2', kind: 'block' },
  )

  assert.deepEqual(state, {
    blockId: 'block-2',
    blockKind: 'block',
    rootId: 'doc-1',
  })
})

test('clearing selection clears root id', () => {
  const state = nextCurrentBlockState(
    { blockId: 'doc-1', blockKind: 'doc', rootId: 'doc-1' },
    { id: null, kind: null },
  )

  assert.deepEqual(state, {
    blockId: null,
    blockKind: null,
    rootId: null,
  })
})
