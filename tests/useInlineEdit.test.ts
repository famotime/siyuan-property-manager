import test from 'node:test'
import assert from 'node:assert/strict'
import { nextTick, ref } from 'vue'
import { useInlineEdit } from '../src/composables/useInlineEdit.ts'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function setup(modelValue: string, opts: Partial<Parameters<typeof useInlineEdit>[0]> = {}) {
  const source = ref(modelValue)
  const committed: string[] = []
  const editChanges: boolean[] = []
  let beforeExitCount = 0
  let cancelCount = 0
  const instance = useInlineEdit({
    modelValue: () => source.value,
    inputEl: ref(null),
    onEditChange: (editing) => { editChanges.push(editing) },
    beforeExit: () => { beforeExitCount++ },
    onCommit: (val) => { committed.push(val) },
    onCancel: () => { cancelCount++ },
    ...opts,
  })
  return { source, committed, editChanges, beforeExitCount: () => beforeExitCount, cancelCount: () => cancelCount, instance }
}

test('enterEdit opens editing state and syncs draft from model value', async () => {
  const { instance, editChanges } = setup('v1')
  instance.enterEdit()
  assert.equal(instance.editing.value, true)
  assert.equal(instance.draft.value, 'v1')
  await nextTick()
  assert.deepEqual(editChanges, [true])
})

test('enterEdit is blocked by readonly guard and while editing', () => {
  const { instance } = setup('v1', { isReadonly: () => true })
  instance.enterEdit()
  assert.equal(instance.editing.value, false)

  const s2 = setup('v1')
  s2.instance.enterEdit()
  s2.instance.draft.value = 'edited'
  s2.instance.enterEdit() // 已在编辑态，不重置草稿
  assert.equal(s2.instance.draft.value, 'edited')
})

test('commit applies transformCommit, notifies edit change and beforeExit', () => {
  const { instance, committed, editChanges, beforeExitCount } = setup('v1', { transformCommit: (d) => d.trim() })
  instance.enterEdit()
  instance.draft.value = '  v2  '
  instance.commit()
  assert.deepEqual(committed, ['v2'])
  assert.deepEqual(editChanges, [true, false])
  assert.equal(beforeExitCount(), 1)
})

test('commit is a no-op when not editing', () => {
  const { instance, committed } = setup('v1')
  instance.commit()
  assert.deepEqual(committed, [])
})

test('cancel restores draft from current model value and emits cancel', () => {
  const { instance, cancelCount } = setup('v1')
  instance.enterEdit()
  instance.draft.value = 'changed'
  instance.cancel()
  assert.equal(instance.editing.value, false)
  assert.equal(instance.draft.value, 'v1')
  assert.equal(cancelCount(), 1)
})

test('external model value change updates draft', async () => {
  const { source, instance } = setup('v1')
  source.value = 'v2'
  await nextTick()
  assert.equal(instance.draft.value, 'v2')
})

test('consumeBlur swallows blur within 200ms of entering edit, commits afterwards', async () => {
  const { instance, committed } = setup('v1')
  instance.enterEdit()
  instance.consumeBlur() // 聚焦动作引发的瞬时 blur，不提交
  assert.deepEqual(committed, [])
  await sleep(230)
  instance.draft.value = 'v2'
  instance.consumeBlur()
  assert.deepEqual(committed, ['v2'])
})
