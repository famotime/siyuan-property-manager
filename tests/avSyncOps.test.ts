import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyAvOp,
  collectAttrChange,
  isAttrViewAction,
  parseBoundAvIds,
} from '../src/utils/avSyncOps.ts'

test('isAttrViewAction mirrors the kernel broadcast predicate', () => {
  assert.equal(isAttrViewAction('updateAttrViewCell'), true)
  assert.equal(isAttrViewAction('insertAttrViewBlock'), true)
  // 内核把 setAttrViewName 排除在「含自身广播」之外
  assert.equal(isAttrViewAction('setAttrViewName'), false)
  assert.equal(isAttrViewAction('updateAttrs'), false)
  assert.equal(isAttrViewAction('update'), false)
})

test('classifyAvOp maps updateAttrViewCell to a cell event', () => {
  const event = classifyAvOp({
    action: 'updateAttrViewCell',
    id: 'value-id',
    avID: '20260101000000-aaaaaaa',
    blockID: '20260101000000-bbbbbbb',
    keyID: '20260101000000-ccccccc',
    rowID: '20260101000000-ddddddd',
    data: { type: 'text', text: { content: 'done' } },
  })
  assert.deepEqual(event, {
    kind: 'cell',
    avID: '20260101000000-aaaaaaa',
    blockID: '20260101000000-bbbbbbb',
    keyID: '20260101000000-ccccccc',
    rowID: '20260101000000-ddddddd',
    data: { type: 'text', text: { content: 'done' } },
  })
})

test('classifyAvOp drops cell events without keyID or rowID', () => {
  assert.equal(classifyAvOp({ action: 'updateAttrViewCell', avID: 'av' }), null)
  assert.equal(classifyAvOp({ action: 'updateAttrViewCell', avID: 'av', keyID: 'k' }), null)
})

test('classifyAvOp maps updateAttrViewCells to a batch cell event', () => {
  const event = classifyAvOp({
    action: 'updateAttrViewCells',
    avID: 'av',
    blockID: 'db',
    cellUpdates: [
      { keyID: 'k1', rowID: 'r1', data: { text: { content: 'a' } } },
      { keyID: '', rowID: 'r2', data: {} },
      null,
    ],
  })
  assert.equal(event?.kind, 'cells')
  assert.deepEqual((event as any).updates, [
    { keyID: 'k1', rowID: 'r1', data: { text: { content: 'a' } } },
  ])
})

test('classifyAvOp maps insertAttrViewBlock and keeps isDetached', () => {
  const event = classifyAvOp({
    action: 'insertAttrViewBlock',
    avID: 'av',
    blockID: 'db',
    srcs: [
      { id: 'blk1', itemID: 'row1', isDetached: false },
      { itemID: 'row2', isDetached: true },
    ],
  })
  assert.equal(event?.kind, 'rows-insert')
  assert.deepEqual((event as any).srcs, [
    { id: 'blk1', itemID: 'row1', isDetached: false },
    { id: undefined, itemID: 'row2', isDetached: true },
  ])
})

test('classifyAvOp maps removeAttrViewBlock to srcIDs', () => {
  const event = classifyAvOp({
    action: 'removeAttrViewBlock',
    avID: 'av',
    blockID: 'db',
    srcIDs: ['row1', 'row2'],
  })
  assert.deepEqual(event, {
    kind: 'rows-remove',
    avID: 'av',
    blockID: 'db',
    srcIDs: ['row1', 'row2'],
  })
})

test('classifyAvOp treats structural and unknown attrview ops as structural', () => {
  assert.equal(classifyAvOp({ action: 'addAttrViewCol', avID: 'av' })?.kind, 'structural')
  assert.equal(classifyAvOp({ action: 'setAttrViewSorts', avID: 'av' })?.kind, 'structural')
  assert.equal(classifyAvOp({ action: 'someFutureAttrViewThing', avID: 'av' })?.kind, 'structural')
})

test('classifyAvOp ignores non-attrview ops', () => {
  assert.equal(classifyAvOp({ action: 'updateAttrs', id: 'blk' }), null)
  assert.equal(classifyAvOp({ action: 'insert', id: 'blk' }), null)
  assert.equal(classifyAvOp(null), null)
  assert.equal(classifyAvOp({ action: 'updateAttrViewCell', avID: '' }), null)
})

test('collectAttrChange picks only really changed custom attributes', () => {
  const event = collectAttrChange({
    action: 'updateAttrs',
    id: 'blk1',
    data: {
      old: { 'custom-status': '待办', 'custom-owner': 'amy', 'custom-avs': 'av1' },
      new: { 'custom-status': '已完成', 'custom-owner': 'amy', 'custom-avs': 'av1' },
    },
  })
  assert.deepEqual(event, {
    blockID: 'blk1',
    changed: { 'custom-status': '已完成' },
    next: { 'custom-status': '已完成', 'custom-owner': 'amy', 'custom-avs': 'av1' },
  })
})

test('collectAttrChange reports deletions as empty strings', () => {
  const event = collectAttrChange({
    action: 'updateAttrs',
    id: 'blk1',
    data: {
      old: { 'custom-status': '待办', 'custom-owner': 'amy' },
      new: { 'custom-owner': 'amy' },
    },
  })
  assert.deepEqual(event?.changed, { 'custom-status': '' })
})

test('collectAttrChange excludes kernel-reserved keys', () => {
  const event = collectAttrChange({
    action: 'updateAttrs',
    id: 'blk1',
    data: {
      old: {},
      new: {
        'custom-avs': 'av1',
        'av-names': '台账',
        'custom-sy-av-s-text-av1': '标题',
        'custom-status': '待办',
        title: '文档标题',
      },
    },
  })
  assert.deepEqual(event?.changed, { 'custom-status': '待办' })
})

test('collectAttrChange returns null when nothing syncable changed', () => {
  assert.equal(collectAttrChange({ action: 'updateAttrs', id: 'blk', data: { old: {}, new: { title: 'x' } } }), null)
  assert.equal(collectAttrChange({ action: 'updateAttrs', id: 'blk', data: { old: {}, new: { 'custom-a': 'v' } } }) === null, false)
  assert.equal(collectAttrChange({ action: 'insert', id: 'blk', data: { new: {} } }), null)
  assert.equal(collectAttrChange({ action: 'updateAttrs', data: { new: { 'custom-a': 'v' } } }), null)
  assert.equal(collectAttrChange({ action: 'updateAttrs', id: 'blk', data: null }), null)
})

test('collectAttrChange ignores unchanged values from other clients', () => {
  assert.equal(collectAttrChange({
    action: 'updateAttrs',
    id: 'blk',
    data: { old: { 'custom-a': 'v' }, new: { 'custom-a': 'v' } },
  }), null)
})

test('parseBoundAvIds reads comma separated custom-avs', () => {
  assert.deepEqual(parseBoundAvIds({ 'custom-avs': 'av1,av2' }), ['av1', 'av2'])
  assert.deepEqual(parseBoundAvIds({ 'custom-avs': ' av1 , av2 ' }), ['av1', 'av2'])
  assert.deepEqual(parseBoundAvIds({}), [])
  assert.deepEqual(parseBoundAvIds(null), [])
})
