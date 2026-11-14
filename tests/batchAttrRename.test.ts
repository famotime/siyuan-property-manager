import test from 'node:test'
import assert from 'node:assert/strict'
import { planBatchReplaceAttrKey } from '../src/utils/batchAttrRename.ts'
import type { AttrStatGroup } from '../src/composables/useSharedStats.ts'

test('planBatchReplaceAttrKey supports full, prefix, and substring replacements with validation', () => {
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
      name: 'custom-my-slide-box',
      values: [{ value: 'true', count: 2, blocks_count: 2 }],
    },
    {
      name: 'custom-other-attr',
      values: [{ value: 'test', count: 1, blocks_count: 1 }],
    },
    {
      name: 'title', // non-custom key, should be ignored
      values: [{ value: 'doc', count: 1, blocks_count: 1 }],
    },
  ]

  // 1. 替换 slide -> slides：同时涵盖完整属性名、前缀、中缀
  const plan1 = planBatchReplaceAttrKey(sampleGroups, 'slide', 'slides')
  assert.equal(plan1.valid, true)
  assert.equal(plan1.items.length, 3)
  assert.equal(plan1.items[0].oldKey, 'custom-slide')
  assert.equal(plan1.items[0].newKey, 'custom-slides')
  assert.equal(plan1.items[0].shortNew, 'slides')
  assert.equal(plan1.items[0].blockCount, 3)

  assert.equal(plan1.items[1].oldKey, 'custom-slide-layout')
  assert.equal(plan1.items[1].newKey, 'custom-slides-layout')
  assert.equal(plan1.items[1].shortNew, 'slides-layout')
  assert.equal(plan1.items[1].blockCount, 5)

  assert.equal(plan1.items[2].oldKey, 'custom-my-slide-box')
  assert.equal(plan1.items[2].newKey, 'custom-my-slides-box')
  assert.equal(plan1.items[2].shortNew, 'my-slides-box')
  assert.equal(plan1.items[2].blockCount, 2)

  // 2. 输入带 custom- 前缀
  const plan2 = planBatchReplaceAttrKey(sampleGroups, 'custom-slide', 'custom-slides')
  assert.equal(plan2.valid, true)
  assert.equal(plan2.items.length, 3)

  // 3. 无匹配项
  const plan3 = planBatchReplaceAttrKey(sampleGroups, 'non-existent', 'target')
  assert.equal(plan3.valid, true)
  assert.equal(plan3.items.length, 0)

  // 4. 输入为空或相同
  const plan4 = planBatchReplaceAttrKey(sampleGroups, '', 'slides')
  assert.equal(plan4.valid, false)
  const plan5 = planBatchReplaceAttrKey(sampleGroups, 'slide', 'slide')
  assert.equal(plan5.valid, false)

  // 5. 非法字符检验
  const plan6 = planBatchReplaceAttrKey(sampleGroups, 'slide', 'sl ides')
  assert.equal(plan6.valid, true)
  assert.equal(plan6.items.length, 0)
  assert.ok(plan6.invalidKeys.length > 0)
})
