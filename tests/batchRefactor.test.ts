import test from 'node:test'
import assert from 'node:assert/strict'
import {
  planKeyRefactor,
  planValueMerge,
  planValueReplace,
} from '../src/utils/batchRefactor.ts'
import { compileRegexPatterns } from '../src/utils/attrStatsFilter.ts'
import type { AttrStatGroup } from '../src/composables/useSharedStats.ts'

const sampleGroups: AttrStatGroup[] = [
  {
    name: 'custom-slide',
    values: [{ value: 'cover', count: 3, blocks_count: 3 }],
  },
  {
    name: 'custom-slide-layout',
    values: [{ value: 'center', count: 5, blocks_count: 5 }],
  },
  {
    name: 'custom-slides-layout', // conflict target
    values: [{ value: 'left', count: 2, blocks_count: 2 }],
  },
  {
    name: 'custom-dailynote-date', // for ignore regex testing
    values: [{ value: '2026-11-16', count: 10, blocks_count: 10 }],
  },
  {
    name: 'custom-status',
    values: [
      { value: 'doing', count: 4, blocks_count: 4 },
      { value: 'wip', count: 2, blocks_count: 2 },
      { value: 'in_progress', count: 8, blocks_count: 8 },
      { value: 'done', count: 12, blocks_count: 12 },
    ],
  },
  {
    name: 'title', // internal non-custom key, should be ignored
    values: [{ value: 'doc', count: 1, blocks_count: 1 }],
  },
]

test('planKeyRefactor - prefix mode with conflict detection and ignore regex', () => {
  const ignoreRegexes = compileRegexPatterns(['^dailynote-.*'])

  // 1. Prefix: slide- -> slides-
  const plan = planKeyRefactor(
    sampleGroups,
    'slide-',
    'slides-',
    'prefix',
    { ignoreRegexes, excludeIgnored: true },
  )

  assert.equal(plan.valid, true)
  assert.equal(plan.items.length, 1)
  assert.equal(plan.items[0].oldKey, 'custom-slide-layout')
  assert.equal(plan.items[0].newKey, 'custom-slides-layout')
  assert.equal(plan.items[0].hasConflict, true) // custom-slides-layout already exists!
  assert.equal(plan.conflictCount, 1)
  assert.equal(plan.ignoredCount, 1) // custom-dailynote-date matched ignore regex
})

test('planKeyRefactor - exact mode', () => {
  const plan = planKeyRefactor(sampleGroups, 'slide', 'presentation', 'exact')
  assert.equal(plan.valid, true)
  assert.equal(plan.items.length, 1)
  assert.equal(plan.items[0].oldKey, 'custom-slide')
  assert.equal(plan.items[0].newKey, 'custom-presentation')
  assert.equal(plan.items[0].hasConflict, false)
})

test('planKeyRefactor - regex mode with capture group', () => {
  const plan = planKeyRefactor(sampleGroups, '^slide-(.+)$', 'presentation-$1', 'regex')
  assert.equal(plan.valid, true)
  assert.equal(plan.items.length, 1)
  assert.equal(plan.items[0].oldKey, 'custom-slide-layout')
  assert.equal(plan.items[0].newKey, 'custom-presentation-layout')
  assert.equal(plan.items[0].shortNew, 'presentation-layout')
})

test('planKeyRefactor - excludeIgnored toggle allows override', () => {
  const ignoreRegexes = compileRegexPatterns(['^dailynote-.*'])

  // Exclude ignored = false
  const plan = planKeyRefactor(
    sampleGroups,
    'dailynote-',
    'journal-',
    'prefix',
    { ignoreRegexes, excludeIgnored: false },
  )

  assert.equal(plan.valid, true)
  assert.equal(plan.items.length, 1)
  assert.equal(plan.items[0].oldKey, 'custom-dailynote-date')
  assert.equal(plan.items[0].newKey, 'custom-journal-date')
  assert.equal(plan.items[0].isIgnored, true)
})

test('planValueMerge - merges multiple selected values into single target value', () => {
  const plan = planValueMerge(sampleGroups, 'custom-status', ['doing', 'wip'], 'in_progress')
  assert.equal(plan.valid, true)
  assert.equal(plan.items.length, 2)
  assert.equal(plan.items[0].oldValue, 'doing')
  assert.equal(plan.items[0].newValue, 'in_progress')
  assert.equal(plan.items[0].blockCount, 4)
  assert.equal(plan.items[1].oldValue, 'wip')
  assert.equal(plan.items[1].newValue, 'in_progress')
  assert.equal(plan.items[1].blockCount, 2)
})

test('planValueReplace - text replace under specific attribute', () => {
  const plan = planValueReplace(sampleGroups, 'custom-status', 'do', 'act')
  assert.equal(plan.valid, true)
  // 'doing' -> 'acting', 'done' -> 'actne'
  assert.equal(plan.items.length, 2)
  assert.equal(plan.items[0].oldValue, 'doing')
  assert.equal(plan.items[0].newValue, 'acting')
})

test('planValueReplace - regex replace respecting ignoreRegexes', () => {
  const ignoreRegexes = compileRegexPatterns(['^dailynote-.*'])
  const plan = planValueReplace(
    sampleGroups,
    null, // across all attributes
    '^2026',
    '2027',
    { isRegex: true, ignoreRegexes, excludeIgnored: true },
  )
  assert.equal(plan.valid, true)
  // custom-dailynote-date has '2026-11-16' but is ignored and excluded!
  assert.equal(plan.items.length, 0)
  assert.equal(plan.ignoredCount, 1)
})
