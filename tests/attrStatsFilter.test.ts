import test from 'node:test'
import assert from 'node:assert/strict'
import {
  matchAttrName,
  filterDocCustomBlocks,
  filterNotebookAttrGroups,
  compileRegexPatterns,
  isAttrNameIgnored,
  getIgnoredAttrGroups,
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

test('compileRegexPatterns compiles valid patterns and skips comments, empty strings, and invalid regex', () => {
  const patterns = [
    '',
    '   ',
    '# comment line',
    '  # another comment',
    '^dailynote-\\d{8}$',
    '[a-z]+-temp',
    '(invalid[regex', // invalid syntax
  ]

  const regexes = compileRegexPatterns(patterns)
  assert.equal(regexes.length, 2)
  assert.equal(regexes[0].source, '^dailynote-\\d{8}$')
  assert.equal(regexes[0].flags, 'i')
  assert.equal(regexes[1].source, '[a-z]+-temp')
})

test('isAttrNameIgnored matches both display name and full custom- name case-insensitively', () => {
  const regexes = compileRegexPatterns([
    '^dailynote-\\d{8}$',
    'custom-audit-.*',
    '^temp_',
  ])

  // display key matching
  assert.equal(isAttrNameIgnored('custom-dailynote-20250721', regexes), true)
  assert.equal(isAttrNameIgnored('custom-DAILYNOTE-20260224', regexes), true)
  assert.equal(isAttrNameIgnored('dailynote-20250721', regexes), true)

  // raw key matching
  assert.equal(isAttrNameIgnored('custom-audit-log', regexes), true)
  assert.equal(isAttrNameIgnored('audit-log', regexes), false) // pattern specifies custom-audit-.*

  // temp_ pattern
  assert.equal(isAttrNameIgnored('custom-temp_abc', regexes), true)
  assert.equal(isAttrNameIgnored('custom-TEMP_XYZ', regexes), true)

  // not ignored
  assert.equal(isAttrNameIgnored('custom-status', regexes), false)
  assert.equal(isAttrNameIgnored('custom-priority', regexes), false)
  assert.equal(isAttrNameIgnored('', regexes), false)
  assert.equal(isAttrNameIgnored('custom-status', []), false)
})

test('getIgnoredAttrGroups and filterNotebookAttrGroups with ignoreRegexes', () => {
  const groups: AttrStatGroup[] = [
    { name: 'custom-status', values: [{ value: 'done', count: 5 }] },
    { name: 'custom-dailynote-20250721', values: [{ value: '1', count: 3 }] },
    { name: 'custom-dailynote-20251031', values: [{ value: '1', count: 1 }] },
    { name: 'custom-priority', values: [{ value: 'high', count: 2 }] },
  ]

  const regexes = compileRegexPatterns(['^dailynote-\\d{8}$'])

  const ignored = getIgnoredAttrGroups(groups, regexes)
  assert.equal(ignored.length, 2)
  assert.deepEqual(ignored.map(g => g.name), ['custom-dailynote-20250721', 'custom-dailynote-20251031'])

  // 1. 无搜索词，带屏蔽
  const filtered = filterNotebookAttrGroups(groups, '', regexes)
  assert.equal(filtered.length, 2)
  assert.deepEqual(filtered.map(g => g.name), ['custom-status', 'custom-priority'])

  // 2. 带搜索词，带屏蔽（即使搜索匹配 dailynote 也被屏蔽过滤掉）
  const filteredSearchIgnored = filterNotebookAttrGroups(groups, 'daily', regexes)
  assert.equal(filteredSearchIgnored.length, 0)

  // 3. 带搜索词，命中未屏蔽项
  const filteredSearchStatus = filterNotebookAttrGroups(groups, 'stat', regexes)
  assert.equal(filteredSearchStatus.length, 1)
  assert.equal(filteredSearchStatus[0].name, 'custom-status')
})
