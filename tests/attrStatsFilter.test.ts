import test from 'node:test'
import assert from 'node:assert/strict'
import {
  matchAttrName,
  filterDocCustomBlocks,
  filterNotebookAttrGroups,
} from '../src/utils/attrStatsFilter'
import type { DocBlockWithAttrs, AttrStatGroup } from '../src/composables/useSharedStats'

test('matchAttrName matches with and without custom- prefix', () => {
  // 空字符串或纯空格匹配所有
  assert.equal(matchAttrName('custom-status', ''), true)
  assert.equal(matchAttrName('custom-status', '   '), true)

  // 显示名（无前缀）模糊匹配
  assert.equal(matchAttrName('custom-status', 'stat'), true)
  assert.equal(matchAttrName('custom-status', 'STATUS'), true)
  assert.equal(matchAttrName('custom-status', '  status  '), true)
  assert.equal(matchAttrName('custom-status', 'tus'), true)

  // 完整名（有前缀）匹配
  assert.equal(matchAttrName('custom-status', 'custom-stat'), true)
  assert.equal(matchAttrName('custom-status', 'custom-'), true)

  // 不匹配
  assert.equal(matchAttrName('custom-status', 'tag'), false)
  assert.equal(matchAttrName('custom-tags', 'status'), false)

  // 异常非 custom- 前缀（防御性）
  assert.equal(matchAttrName('plain-key', 'plain'), true)
  assert.equal(matchAttrName('plain-key', 'other'), false)
})

test('filterDocCustomBlocks filters blocks containing matching custom attributes', () => {
  const blocks: DocBlockWithAttrs[] = [
    {
      id: 'b1',
      rootId: 'r1',
      content: 'Block 1',
      type: 'p',
      attrs: [
        { key: 'custom-status', value: 'done' },
        { key: 'custom-priority', value: 'high' },
      ],
    },
    {
      id: 'b2',
      rootId: 'r1',
      content: 'Block 2',
      type: 'p',
      attrs: [
        { key: 'custom-category', value: 'work' },
      ],
    },
    {
      id: 'b3',
      rootId: 'r1',
      content: 'Block 3',
      type: 'p',
      attrs: [],
    },
  ]

  // 空关键词返回所有
  assert.deepEqual(filterDocCustomBlocks(blocks, ''), blocks)
  assert.deepEqual(filterDocCustomBlocks(blocks, '   '), blocks)

  // 筛选 status
  const resStatus = filterDocCustomBlocks(blocks, 'status')
  assert.equal(resStatus.length, 1)
  assert.equal(resStatus[0].id, 'b1')

  // 筛选 or (priority and category both contain 'or')
  const resOr = filterDocCustomBlocks(blocks, 'or')
  assert.equal(resOr.length, 2)
  assert.deepEqual(resOr.map(b => b.id), ['b1', 'b2'])

  // 筛选不存在的
  assert.deepEqual(filterDocCustomBlocks(blocks, 'non-existent'), [])
})

test('filterNotebookAttrGroups filters groups by attribute name', () => {
  const groups: AttrStatGroup[] = [
    {
      name: 'custom-status',
      values: [{ value: 'done', count: 5 }],
    },
    {
      name: 'custom-priority',
      values: [{ value: 'high', count: 2 }],
    },
    {
      name: 'custom-category',
      values: [{ value: 'work', count: 8 }],
    },
  ]

  assert.deepEqual(filterNotebookAttrGroups(groups, ''), groups)
  assert.deepEqual(filterNotebookAttrGroups(groups, '   '), groups)

  const resStatus = filterNotebookAttrGroups(groups, 'stat')
  assert.equal(resStatus.length, 1)
  assert.equal(resStatus[0].name, 'custom-status')

  const resOr = filterNotebookAttrGroups(groups, 'or')
  assert.equal(resOr.length, 2)
  assert.deepEqual(resOr.map(g => g.name), ['custom-priority', 'custom-category'])

  assert.deepEqual(filterNotebookAttrGroups(groups, 'unknown'), [])
})
