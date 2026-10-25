import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAvJsonWithAttrs } from '../src/utils/avDatabaseJson.ts'

const OPTS = {
  primaryKeyName: '主键',
  tableViewName: '表格',
  resolveType: (fullKey: string) => {
    if (fullKey === 'custom-status')
      return 'select' as const
    if (fullKey === 'custom-score')
      return 'number' as const
    return 'text' as const
  },
  getOptions: (fullKey: string) => {
    if (fullKey === 'custom-status')
      return [
        { id: 'opt-1', value: 'todo', label: '待办', color: '#f00' },
        { id: 'opt-2', value: 'done', label: '已完成', color: '#0f0' },
      ]
    return []
  },
}

test('builds spec-4 AV JSON with primary block column first', () => {
  const { json, keyIdMap, columnTypeMap } = buildAvJsonWithAttrs('av-1', ['custom-status', 'custom-score'], OPTS)
  const data = JSON.parse(json)

  assert.equal(data.spec, 4)
  assert.equal(data.id, 'av-1')
  assert.equal(data.name, '')
  // 主键列在首位，类型 block
  assert.equal(data.keyValues[0].key.type, 'block')
  assert.equal(data.keyValues[0].key.name, '主键')
  // 视图
  assert.equal(data.views[0].type, 'table')
  assert.equal(data.views[0].name, '表格')
  assert.equal(data.views[0].table.columns.length, 3) // 主键 + 2 属性列

  assert.deepEqual(Object.keys(keyIdMap), ['custom-status', 'custom-score'])
  assert.equal(columnTypeMap['custom-status'], 'select')
  assert.equal(columnTypeMap['custom-score'], 'number')
})

test('normalizes attr keys to custom- prefix and derives column types from schema', () => {
  const { json, keyIdMap } = buildAvJsonWithAttrs('av-2', ['status', 'custom-score'], OPTS)
  const data = JSON.parse(json)

  assert.deepEqual(Object.keys(keyIdMap), ['custom-status', 'custom-score'])
  const [statusKey, scoreKey] = data.keyValues.slice(1).map((kv: any) => kv.key)
  assert.equal(statusKey.name, 'custom-status')
  assert.equal(statusKey.type, 'select')
  assert.equal(scoreKey.name, 'custom-score')
  assert.equal(scoreKey.type, 'number')
})

test('select/mSelect columns carry options with 1-14 palette color indexes', () => {
  const { json } = buildAvJsonWithAttrs('av-3', ['custom-status'], OPTS)
  const data = JSON.parse(json)
  const statusKey = data.keyValues[1].key

  assert.deepEqual(statusKey.options, [
    { name: 'todo', color: '1', desc: '待办' },
    { name: 'done', color: '2', desc: '已完成' },
  ])
})

test('palette colors cycle after 14 options', () => {
  const opts = {
    ...OPTS,
    getOptions: () => Array.from({ length: 16 }, (_, i) => ({ id: `opt-${i}`, value: `o${i}`, label: `o${i}` })),
  }
  const { json } = buildAvJsonWithAttrs('av-4', ['custom-status'], opts)
  const options = JSON.parse(json).keyValues[1].key.options
  assert.equal(options[13].color, '14')
  assert.equal(options[14].color, '1')
  assert.equal(options[15].color, '2')
})

test('text columns carry no options pool', () => {
  const { json } = buildAvJsonWithAttrs('av-5', ['custom-plain'], OPTS)
  const key = JSON.parse(json).keyValues[1].key
  assert.equal(key.type, 'text')
  assert.equal('options' in key, false)
})

test('dbName is written to the AV root', () => {
  const { json } = buildAvJsonWithAttrs('av-6', ['custom-plain'], { ...OPTS, dbName: '项目库' })
  assert.equal(JSON.parse(json).name, '项目库')
})
