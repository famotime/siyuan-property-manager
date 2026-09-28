import test from 'node:test'
import assert from 'node:assert/strict'
import {
  _resetSchemasForTest,
  useAttrSchema,
} from '../src/composables/useAttrSchema.ts'

test('useAttrSchema resolves type using configured schema first', () => {
  _resetSchemasForTest({
    'custom-status': {
      name: 'custom-status',
      type: 'select',
      options: [{ id: '1', label: 'Todo', value: 'todo' }],
    },
  })
  const { resolveAttrType, getSchema } = useAttrSchema()
  assert.equal(resolveAttrType('custom-status', 'todo'), 'select')
  assert.equal(getSchema('custom-status')?.type, 'select')
})

test('useAttrSchema falls back to heuristic inference when no schema configured', () => {
  _resetSchemasForTest({})
  const { resolveAttrType } = useAttrSchema()
  assert.equal(resolveAttrType('custom-created', '2026-09-28'), 'date')
  assert.equal(resolveAttrType('custom-is_done', 'true'), 'checkbox')
  assert.equal(resolveAttrType('custom-unknown', 'some text'), 'text')
})

test('useAttrSchema updates type and options correctly', () => {
  _resetSchemasForTest({})
  const { setAttrType, addAttrOption, removeAttrOption, getSchema } = useAttrSchema()

  setAttrType('custom-priority', 'select')
  assert.equal(getSchema('custom-priority')?.type, 'select')

  const opt = addAttrOption('custom-priority', { label: 'High', value: 'high' })
  assert.equal(opt.value, 'high')
  assert.equal(getSchema('custom-priority')?.options?.length, 1)

  // Duplicate add should return existing
  const dup = addAttrOption('custom-priority', { label: 'High', value: 'high' })
  assert.equal(dup.id, opt.id)
  assert.equal(getSchema('custom-priority')?.options?.length, 1)

  removeAttrOption('custom-priority', 'high')
  assert.equal(getSchema('custom-priority')?.options?.length, 0)
})

test('useAttrSchema renameSchema migrates schema configuration to new key', () => {
  _resetSchemasForTest({
    'custom-status': {
      name: 'custom-status',
      type: 'select',
      options: [{ id: '1', label: 'Todo', value: 'todo' }],
    },
  })
  const { renameSchema, getSchema } = useAttrSchema()
  renameSchema('custom-status', 'custom-task_status')
  assert.equal(getSchema('custom-status'), undefined)
  assert.equal(getSchema('custom-task_status')?.type, 'select')
  assert.equal(getSchema('custom-task_status')?.name, 'custom-task_status')
})

test('useAttrSchema resetToDefaults restores common preset schemas', async () => {
  _resetSchemasForTest({})
  const { resetToDefaults, getSchema, getAllSchemas } = useAttrSchema()
  await resetToDefaults()

  const all = getAllSchemas()
  assert.ok(all.length >= 5)
  assert.equal(getSchema('custom-status')?.type, 'select')
  assert.equal(getSchema('custom-priority')?.type, 'select')
  assert.equal(getSchema('custom-deadline')?.type, 'date')
  assert.equal(getSchema('custom-archived')?.type, 'checkbox')
})
