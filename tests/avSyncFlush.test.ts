import test from 'node:test'
import assert from 'node:assert/strict'
import type { AvIndex } from '../src/types/avSync.d.ts'
import {
  planAttrFlush,
  planCellFlush,
} from '../src/utils/avSyncFlush.ts'
import type { FlushAttrItem, FlushCellItem } from '../src/utils/avSyncFlush.ts'

function makeIndex(overrides: Partial<AvIndex> = {}): AvIndex {
  return {
    avID: 'av1',
    builtAt: 0,
    blockKeyID: 'pk',
    columns: new Map(),
    byAttrKey: new Map(),
    rowToBlock: new Map(),
    blockToRow: new Map(),
    detachedRowIds: new Set(),
    columnOrder: [],
    rowCells: new Map(),
    stale: false,
    ...overrides,
  }
}

function cellItem(partial: Partial<FlushCellItem>): FlushCellItem {
  return { avID: 'av1', blockID: '', keyID: '', rowID: '', data: null, ...partial }
}

function attrItem(partial: Partial<FlushAttrItem>): FlushAttrItem {
  return { avID: 'av1', blockID: '', attrKey: '', value: '', ...partial }
}

test('planCellFlush groups resolved items by block in arrival order', async () => {
  const index = makeIndex({
    columns: new Map([
      ['k1', { keyID: 'k1', name: '状态', type: 'text', attrKey: 'custom-status' }],
      ['k2', { keyID: 'k2', name: '数量', type: 'number', attrKey: 'custom-count' }],
    ]),
    rowToBlock: new Map([['r1', 'b1']]),
  })
  const plan = await planCellFlush(
    [
      cellItem({ keyID: 'k1', rowID: 'r1', data: { text: { content: 'todo' } } }),
      cellItem({ keyID: 'k2', rowID: 'r1', data: { number: { content: 3, isNotEmpty: true } } }),
    ],
    {
      getIndex: async () => index,
      decode: (type, data) => (type === 'text' ? String(data?.text?.content ?? '') : '3'),
      budget: 10,
    },
  )

  assert.equal(plan.taken.length, 2)
  assert.deepEqual(plan.overflow, [])
  // 到达顺序保持不变（LWW 语义的根基）
  assert.equal(plan.taken[0].attrKey, 'custom-status')
  assert.equal(plan.taken[0].blockID, 'b1')
  assert.equal(plan.taken[1].attrKey, 'custom-count')
})

test('planCellFlush counts unmapped columns, detached rows and undecodable values as skipped', async () => {
  const index = makeIndex({
    columns: new Map([
      ['k1', { keyID: 'k1', name: '状态', type: 'text', attrKey: 'custom-status' }],
      ['k9', { keyID: 'k9', name: '主键', type: 'block', attrKey: null }],
    ]),
    rowToBlock: new Map([['r1', 'b1']]),
    detachedRowIds: new Set(['r2']),
  })
  const plan = await planCellFlush(
    [
      cellItem({ keyID: 'k9', rowID: 'r1' }), // 主键列 → skip
      cellItem({ keyID: 'kX', rowID: 'r1' }), // 未注册列 → skip
      cellItem({ keyID: 'k1', rowID: 'r2' }), // 游离行 → skip
      cellItem({ keyID: 'k1', rowID: 'r1', data: {} }), // 解码为 null → skip
      cellItem({ keyID: 'k1', rowID: 'r1', data: { text: { content: 'ok' } } }),
    ],
    {
      getIndex: async () => index,
      decode: (type, data) => (data?.text?.content == null ? null : String(data.text.content)),
      budget: 10,
    },
  )

  assert.equal(plan.taken.length, 1)
  assert.deepEqual(plan.skippedByAv, { av1: 4 })
})

test('planCellFlush parks items beyond budget into overflow instead of dropping them', async () => {
  const index = makeIndex({
    columns: new Map([['k1', { keyID: 'k1', name: '状态', type: 'text', attrKey: 'custom-status' }]]),
    rowToBlock: new Map([['r1', 'b1'], ['r2', 'b2'], ['r3', 'b3'], ['r4', 'b4']]),
  })
  const items = ['r1', 'r2', 'r3', 'r4'].map(rowID =>
    cellItem({ keyID: 'k1', rowID, data: { text: { content: rowID } } }),
  )
  const plan = await planCellFlush(items, {
    getIndex: async () => index,
    decode: (_type, data) => String(data.text.content),
    budget: 2,
  })

  // 预算内的前两项按到达序采纳
  assert.deepEqual(plan.taken.map(item => item.blockID), ['b1', 'b2'])
  // 预算耗尽后的项进入 overflow（旧行为是 break 后永久丢弃），保留原始入队信息供回灌
  assert.deepEqual(plan.overflow.map(item => item.avID), ['av1', 'av1'])
})

test('planCellFlush stops resolving index once budget is exhausted', async () => {
  let indexLookups = 0
  const plan = await planCellFlush(
    [cellItem({ keyID: 'k1', rowID: 'r1' }), cellItem({ keyID: 'k1', rowID: 'r1' })],
    {
      getIndex: async () => {
        indexLookups++
        return makeIndex({
          columns: new Map([['k1', { keyID: 'k1', name: '状态', type: 'text', attrKey: 'custom-status' }]]),
          rowToBlock: new Map([['r1', 'b1']]),
        })
      },
      decode: () => 'v',
      budget: 1,
    },
  )
  assert.equal(plan.taken.length, 1)
  assert.equal(plan.overflow.length, 1)
  assert.equal(indexLookups, 1, '预算耗尽后不再触发索引构建')
})

test('planAttrFlush consumes echo tokens only when the value matches', async () => {
  const tokens = new Map<string, string>([
    ['b1\0custom-status', 'from-av'],
  ])
  const consumed: string[] = []
  const plan = await planAttrFlush(
    [
      attrItem({ blockID: 'b1', attrKey: 'custom-status', value: 'from-av' }),
      attrItem({ blockID: 'b1', attrKey: 'custom-status', value: 'user-edit' }),
    ],
    {
      isEnabled: () => true,
      consumeEcho: (blockID, attrKey, value) => {
        const key = `${blockID}\0${attrKey}`
        if (tokens.get(key) === value) {
          tokens.delete(key)
          consumed.push(key)
          return true
        }
        return false
      },
      getIndex: async () => makeIndex({
        byAttrKey: new Map([['custom-status', { keyID: 'k1', name: '状态', type: 'text', attrKey: 'custom-status' }]]),
        blockToRow: new Map([['b1', 'i1']]),
      }),
      resolveAttrType: () => 'text',
      encode: (_type, value) => ({ text: { content: value } }),
      budget: 10,
    },
  )

  // 回声命中的第一项被跳过且令牌被消费；用户编辑不匹配，正常写回
  assert.equal(plan.taken.length, 1)
  assert.deepEqual(plan.skippedByAv, { av1: 1 })
  assert.deepEqual(consumed, ['b1\0custom-status'])
  assert.equal(tokens.size, 0)
})

test('planAttrFlush skips disabled registries, unmapped attrs and unencodable values', async () => {
  const enabled: Record<string, boolean> = { av1: true, av2: false }
  const index = makeIndex({
    byAttrKey: new Map([['custom-status', { keyID: 'k1', name: '状态', type: 'number', attrKey: 'custom-status' }]]),
    blockToRow: new Map([['b1', 'i1']]),
  })
  const plan = await planAttrFlush(
    [
      attrItem({ avID: 'av2', blockID: 'b1', attrKey: 'custom-status', value: 'x' }), // 未启用 → skip
      attrItem({ blockID: 'b1', attrKey: 'custom-other', value: 'x' }), // 未映射属性 → skip
      attrItem({ blockID: 'b9', attrKey: 'custom-status', value: 'x' }), // 无绑定行 → skip
      attrItem({ blockID: 'b1', attrKey: 'custom-status', value: 'not-a-number' }), // 编码失败 → skip
      attrItem({ blockID: 'b1', attrKey: 'custom-status', value: '42' }),
    ],
    {
      isEnabled: avID => enabled[avID] === true,
      consumeEcho: () => false,
      getIndex: async () => index,
      resolveAttrType: () => 'text',
      encode: (type, value) => (type === 'number' && Number.isFinite(Number(value)) ? { number: { content: Number(value) } } : null),
      budget: 10,
    },
  )

  assert.equal(plan.taken.length, 1)
  assert.equal(plan.taken[0].itemID, 'i1')
  assert.deepEqual(plan.skippedByAv, { av1: 3, av2: 1 })
})

test('planAttrFlush parks items beyond budget into overflow', async () => {
  const index = makeIndex({
    byAttrKey: new Map([['custom-status', { keyID: 'k1', name: '状态', type: 'text', attrKey: 'custom-status' }]]),
    blockToRow: new Map([['b1', 'i1'], ['b2', 'i2'], ['b3', 'i3']]),
  })
  const plan = await planAttrFlush(
    [
      attrItem({ blockID: 'b1', attrKey: 'custom-status', value: 'v1' }),
      attrItem({ blockID: 'b2', attrKey: 'custom-status', value: 'v2' }),
      attrItem({ blockID: 'b3', attrKey: 'custom-status', value: 'v3' }),
    ],
    {
      isEnabled: () => true,
      consumeEcho: () => false,
      getIndex: async () => index,
      resolveAttrType: () => 'text',
      encode: (_type, value) => ({ text: { content: value } }),
      budget: 2,
    },
  )
  assert.equal(plan.taken.length, 2)
  assert.equal(plan.overflow.length, 1)
})
