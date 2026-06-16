import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSyTreeOrderMap, sortBlocksByDocOrder, SyTreeNode } from '../src/utils/blockOrder.ts'

test('buildSyTreeOrderMap - builds map with correct order based on DFS traversal', () => {
  const root: SyTreeNode = {
    ID: 'root-1',
    Children: [
      {
        ID: 'child-1',
        Children: [
          { Properties: { id: 'grandchild-1' } }
        ]
      },
      { ID: 'child-2' }
    ]
  }

  const map = buildSyTreeOrderMap(root)
  assert.equal(map.get('root-1'), 0)
  assert.equal(map.get('child-1'), 1)
  assert.equal(map.get('grandchild-1'), 2)
  assert.equal(map.get('child-2'), 3)
})

test('sortBlocksByDocOrder - correctly sorts blocks using DFS and sorts siblings by sort/index', () => {
  const allDocBlocks = [
    { id: 'child-2', parent_id: 'root-1', sort: 2 },
    { id: 'child-1', parent_id: 'root-1', sort: 1 },
    { id: 'grandchild-1', parent_id: 'child-1', sort: 1 },
    { id: 'root-1', parent_id: null, sort: 0 }
  ]
  const targetIds = ['grandchild-1', 'child-2', 'child-1']
  
  const result = sortBlocksByDocOrder(targetIds, allDocBlocks, 'doc-1')
  // DFS should yield child-1, grandchild-1, child-2
  assert.deepEqual(result, ['child-1', 'grandchild-1', 'child-2'])
})

test('sortBlocksByDocOrder - stable sorting fallback when sort property is the same', () => {
  const allDocBlocks = [
    { id: 'block-B', parent_id: 'root-1', sort: 1 },
    { id: 'block-A', parent_id: 'root-1', sort: 1 },
    { id: 'root-1', parent_id: null, sort: 0 }
  ]
  const targetIds = ['block-A', 'block-B']
  
  const result = sortBlocksByDocOrder(targetIds, allDocBlocks, 'doc-1')
  // Stable sort uses index, block-B is before block-A in allDocBlocks
  assert.deepEqual(result, ['block-B', 'block-A'])
})

test('sortBlocksByDocOrder - leaves unvisited ids at the end', () => {
  const allDocBlocks = [
    { id: 'block-1', parent_id: 'root-1', sort: 1 }
  ]
  const targetIds = ['block-1', 'missing-block']
  
  const result = sortBlocksByDocOrder(targetIds, allDocBlocks, 'doc-1')
  assert.deepEqual(result, ['block-1', 'missing-block'])
})
