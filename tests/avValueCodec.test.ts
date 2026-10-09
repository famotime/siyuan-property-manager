import test from 'node:test'
import assert from 'node:assert/strict'
import {
  avColumnTypeFromAttrType,
  decodeAvCellToIal,
  encodeIalToAvCell,
  formatAvNumber,
  formatDateMsToIal,
  isBlankIalValue,
  parseIalDate,
} from '../src/utils/avValueCodec.ts'

// ---- 解码：AV 单元格 → IAL ----

test('decodeAvCellToIal reads text cells', () => {
  assert.equal(decodeAvCellToIal('text', { text: { content: '项目 A' } }), '项目 A')
  assert.equal(decodeAvCellToIal('text', {}), '')
  assert.equal(decodeAvCellToIal('text', null), '')
})

test('decodeAvCellToIal reads numbers and treats unfilled as empty', () => {
  assert.equal(decodeAvCellToIal('number', { number: { content: 42.5, isNotEmpty: true } }), '42.5')
  assert.equal(decodeAvCellToIal('number', { number: { content: 42, isNotEmpty: true } }), '42')
  assert.equal(decodeAvCellToIal('number', { number: { content: 0, isNotEmpty: false } }), '')
  assert.equal(decodeAvCellToIal('number', {}), '')
})

test('decodeAvCellToIal formats dates with and without time', () => {
  const ms = new Date(2026, 9, 9).getTime()
  assert.equal(decodeAvCellToIal('date', { date: { content: ms, isNotEmpty: true, isNotTime: true } }), '2026-10-09')
  assert.equal(decodeAvCellToIal('date', { date: { content: ms, isNotEmpty: true, isNotTime: false } }), '2026-10-09 00:00:00')
  // isNotTime 缺省视为纯日期
  assert.equal(decodeAvCellToIal('date', { date: { content: ms, isNotEmpty: true } }), '2026-10-09')
  assert.equal(decodeAvCellToIal('date', { date: { content: 0, isNotEmpty: false } }), '')
})

test('decodeAvCellToIal reads select and multi-select', () => {
  assert.equal(decodeAvCellToIal('select', { mSelect: [{ content: '进行中', color: '1' }] }), '进行中')
  assert.equal(decodeAvCellToIal('select', { mSelect: [] }), '')
  assert.equal(
    decodeAvCellToIal('mSelect', { mSelect: [{ content: 'dev' }, { content: 'test' }] }),
    'dev, test',
  )
  assert.equal(decodeAvCellToIal('mSelect', { mSelect: [{ content: '' }] }), '')
})

test('decodeAvCellToIal reads checkbox as literal booleans', () => {
  assert.equal(decodeAvCellToIal('checkbox', { checkbox: { checked: true } }), 'true')
  assert.equal(decodeAvCellToIal('checkbox', { checkbox: { checked: false } }), 'false')
  assert.equal(decodeAvCellToIal('checkbox', {}), 'false')
})

test('decodeAvCellToIal reads url/email/phone', () => {
  assert.equal(decodeAvCellToIal('url', { url: { content: 'https://siyuan.note' } }), 'https://siyuan.note')
  assert.equal(decodeAvCellToIal('email', { email: { content: 'a@b.c' } }), 'a@b.c')
  assert.equal(decodeAvCellToIal('phone', { phone: { content: '123' } }), '123')
})

test('decodeAvCellToIal refuses column types that have no IAL counterpart', () => {
  for (const type of ['block', 'created', 'updated', 'template', 'rollup', 'lineNumber', 'relation', 'mAsset', 'unknown'])
    assert.equal(decodeAvCellToIal(type, {}), null, `${type} should not be syncable`)
})

// ---- 编码：IAL → AV 单元格 ----

test('encodeIalToAvCell writes text cells verbatim', () => {
  assert.deepEqual(encodeIalToAvCell('text', '项目 A'), { text: { content: '项目 A' } })
  assert.deepEqual(encodeIalToAvCell('text', ''), { text: { content: '' } })
})

test('encodeIalToAvCell parses numbers and rejects non numeric values', () => {
  assert.deepEqual(encodeIalToAvCell('number', '42'), { number: { content: 42, isNotEmpty: true } })
  assert.deepEqual(encodeIalToAvCell('number', ' 3.5 '), { number: { content: 3.5, isNotEmpty: true } })
  assert.deepEqual(encodeIalToAvCell('number', ''), { number: { content: 0, isNotEmpty: false } })
  assert.equal(encodeIalToAvCell('number', 'abc'), null)
})

test('encodeIalToAvCell parses dates and keeps time information', () => {
  const dateOnly = encodeIalToAvCell('date', '2026-10-09') as any
  assert.equal(dateOnly.date.isNotEmpty, true)
  assert.equal(dateOnly.date.isNotTime, true)
  assert.equal(dateOnly.date.content, new Date(2026, 9, 9).getTime())

  const withTime = encodeIalToAvCell('date', '2026-10-09 08:30:15') as any
  assert.equal(withTime.date.isNotTime, false)
  assert.equal(withTime.date.content, new Date(2026, 9, 9, 8, 30, 15).getTime())

  assert.equal(encodeIalToAvCell('date', 'not-a-date'), null)
  assert.deepEqual(encodeIalToAvCell('date', ''), { date: { content: 0, isNotEmpty: false } })
})

test('encodeIalToAvCell handles select and multi-select without preset colors', () => {
  assert.deepEqual(encodeIalToAvCell('select', '进行中', 'select'), {
    mSelect: [{ content: '进行中', color: '' }],
  })
  assert.deepEqual(encodeIalToAvCell('mSelect', 'dev, test', 'multi-select'), {
    mSelect: [{ content: 'dev', color: '' }, { content: 'test', color: '' }],
  })
  assert.deepEqual(encodeIalToAvCell('mSelect', '标签1，标签2'), {
    mSelect: [{ content: '标签1', color: '' }, { content: '标签2', color: '' }],
  })
  assert.deepEqual(encodeIalToAvCell('select', ''), { mSelect: [] })
  assert.deepEqual(encodeIalToAvCell('mSelect', ''), { mSelect: [] })
})

test('encodeIalToAvCell maps checkbox truthiness consistently with the panel UI', () => {
  assert.deepEqual(encodeIalToAvCell('checkbox', 'true'), { checkbox: { checked: true } })
  assert.deepEqual(encodeIalToAvCell('checkbox', '1'), { checkbox: { checked: true } })
  assert.deepEqual(encodeIalToAvCell('checkbox', 'false'), { checkbox: { checked: false } })
  assert.deepEqual(encodeIalToAvCell('checkbox', ''), { checkbox: { checked: false } })
})

test('encodeIalToAvCell writes url/email/phone', () => {
  assert.deepEqual(encodeIalToAvCell('url', 'https://a.b'), { url: { content: 'https://a.b' } })
  assert.deepEqual(encodeIalToAvCell('email', 'a@b.c'), { email: { content: 'a@b.c' } })
  assert.deepEqual(encodeIalToAvCell('phone', '123'), { phone: { content: '123' } })
})

test('encodeIalToAvCell refuses unsynced column types', () => {
  for (const type of ['block', 'relation', 'rollup', 'template', 'created', 'updated', 'lineNumber', 'mAsset'])
    assert.equal(encodeIalToAvCell(type, 'x'), null, `${type} should not be syncable`)
})

// ---- 往返 ----

test('codec round trips every supported column type except lossy date time', () => {
  const cases: Array<[string, string]> = [
    ['text', '项目 A'],
    ['number', '42.5'],
    ['date', '2026-10-09'],
    ['date', '2026-10-09 08:30:15'],
    ['select', '进行中'],
    ['mSelect', 'dev, test'],
    ['checkbox', 'true'],
    ['checkbox', 'false'],
    ['url', 'https://a.b'],
    ['email', 'a@b.c'],
    ['phone', '123'],
  ]
  for (const [columnType, ialValue] of cases) {
    const cell = encodeIalToAvCell(columnType, ialValue)
    assert.ok(cell, `${columnType}/${ialValue} should encode`)
    assert.equal(decodeAvCellToIal(columnType, cell), ialValue, `${columnType}/${ialValue} should round trip`)
  }
})

test('codec round trips empty values as empty', () => {
  for (const columnType of ['text', 'number', 'date', 'select', 'mSelect', 'url']) {
    const cell = encodeIalToAvCell(columnType, '')
    assert.equal(decodeAvCellToIal(columnType, cell), '', `${columnType} empty should stay empty`)
  }
})

// ---- 工具函数 ----

test('isBlankIalValue treats whitespace as blank', () => {
  assert.equal(isBlankIalValue(''), true)
  assert.equal(isBlankIalValue('   '), true)
  assert.equal(isBlankIalValue(null), true)
  assert.equal(isBlankIalValue('false'), false)
  assert.equal(isBlankIalValue('0'), false)
})

test('formatAvNumber only yields a value when filled', () => {
  assert.equal(formatAvNumber({ content: 1, isNotEmpty: true }), '1')
  assert.equal(formatAvNumber({ content: 1, isNotEmpty: false }), '')
  assert.equal(formatAvNumber(null), '')
  assert.equal(formatAvNumber({ content: Number.NaN, isNotEmpty: true }), '')
})

test('parseIalDate and formatDateMsToIal are consistent', () => {
  assert.deepEqual(parseIalDate('2026-10-09'), { ms: new Date(2026, 9, 9).getTime(), isNotTime: true })
  assert.equal(parseIalDate('2026/10/09'), null)
  assert.equal(formatDateMsToIal(new Date(2026, 9, 9).getTime(), true), '2026-10-09')
  assert.equal(formatDateMsToIal(new Date(2026, 9, 9, 8, 5, 4).getTime(), false), '2026-10-09 08:05:04')
})

test('avColumnTypeFromAttrType maps schema types onto attribute view column types', () => {
  assert.equal(avColumnTypeFromAttrType('text'), 'text')
  assert.equal(avColumnTypeFromAttrType('number'), 'number')
  assert.equal(avColumnTypeFromAttrType('select'), 'select')
  assert.equal(avColumnTypeFromAttrType('multi-select'), 'mSelect')
  assert.equal(avColumnTypeFromAttrType('date'), 'date')
  assert.equal(avColumnTypeFromAttrType('checkbox'), 'checkbox')
  assert.equal(avColumnTypeFromAttrType('block-ref'), 'text')
})
