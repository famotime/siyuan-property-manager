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

test('useAttrSchema resetToDefaults restores common preset schemas with category and rich scenarios', async () => {
  _resetSchemasForTest({})
  const { resetToDefaults, getSchema, getAllSchemas } = useAttrSchema()
  await resetToDefaults()

  const all = getAllSchemas()
  assert.ok(all.length >= 22)
  assert.equal(getSchema('custom-status')?.type, 'select')
  assert.equal(getSchema('custom-priority')?.type, 'select')
  assert.equal(getSchema('custom-category')?.type, 'select')
  assert.equal(getSchema('custom-tags'), undefined) // tags 冲突已移除并改为 category
  assert.equal(getSchema('custom-deadline')?.type, 'date')
  assert.equal(getSchema('custom-start-date')?.type, 'date')
  assert.equal(getSchema('custom-review-date')?.type, 'date')
  assert.equal(getSchema('custom-archived')?.type, 'checkbox')
  assert.equal(getSchema('custom-starred')?.type, 'checkbox')
  assert.equal(getSchema('custom-assignee')?.type, 'text')
  assert.equal(getSchema('custom-project')?.type, 'text')
  assert.equal(getSchema('custom-mood')?.type, 'select')
  assert.equal(getSchema('custom-cost')?.type, 'number')
  assert.equal(getSchema('custom-relation')?.type, 'block-ref')
  assert.equal(getSchema('custom-relation')?.label, '关联')
})

test('presets cover the SiYuan attribute-view column types not yet represented', async () => {
  _resetSchemasForTest({})
  const { resetToDefaults, getSchema } = useAttrSchema()
  await resetToDefaults()

  // mSelect / url / email / phone / mAsset 各补一条预设（其余 AV 类型已被既有预设覆盖）
  assert.equal(getSchema('custom-labels')?.type, 'multi-select')
  assert.equal(getSchema('custom-labels')?.label, '标签')
  assert.equal(getSchema('custom-link')?.type, 'text')
  assert.equal(getSchema('custom-link')?.label, '链接')
  assert.equal(getSchema('custom-email')?.type, 'text')
  assert.equal(getSchema('custom-email')?.label, '邮箱')
  assert.equal(getSchema('custom-phone')?.type, 'text')
  assert.equal(getSchema('custom-phone')?.label, '电话')
  assert.equal(getSchema('custom-attachment')?.type, 'text')
  assert.equal(getSchema('custom-attachment')?.label, '附件')

  // custom-tags 已被迁移到 custom-category，绝不可作为预设回归
  assert.equal(getSchema('custom-tags'), undefined)
})

test('initSchemas smoothly migrates custom-tags to custom-category and merges presets', async () => {
  let savedData: any = null
  const mockPlugin: any = {
    loadData: async () => ({
      version: 1,
      schemas: {
        'custom-tags': {
          name: 'custom-tags',
          type: 'multi-select',
          label: '标签',
          options: [{ id: 'w', label: '工作', value: '工作' }],
        },
      },
    }),
    saveData: async (_name: string, payload: any) => {
      savedData = payload
    },
  }

  const { initSchemas } = await import('../src/composables/useAttrSchema.ts')
  await initSchemas(mockPlugin)
  const { getSchema } = useAttrSchema()

  assert.equal(getSchema('custom-tags'), undefined)
  assert.equal(getSchema('custom-category')?.type, 'select')
  assert.equal(getSchema('custom-category')?.label, '分类')
  assert.equal(savedData?.schemas?.['custom-category']?.name, 'custom-category')
  assert.equal(savedData?.schemas?.['custom-category']?.type, 'select')
  assert.equal(savedData?.schemas?.['custom-tags'], undefined)
  // 并且补充合并了新预设
  assert.ok(getSchema('custom-status'))
  assert.ok(getSchema('custom-mood'))
})

test('useAttrSchema preserves and updates custom labels', () => {
  const { setAttrType, renameSchema, getSchema } = useAttrSchema()

  // 1. 新增属性时带备注
  setAttrType('custom-project-lead', 'text', '项目负责人')
  assert.equal(getSchema('custom-project-lead')?.label, '项目负责人')

  // 2. 修改属性备注（key 不变）
  renameSchema('custom-project-lead', 'custom-project-lead', '主负责人')
  assert.equal(getSchema('custom-project-lead')?.label, '主负责人')

  // 3. 重命名 key 并修改备注
  renameSchema('custom-project-lead', 'custom-lead', '总负责人')
  assert.equal(getSchema('custom-project-lead'), undefined)
  assert.equal(getSchema('custom-lead')?.label, '总负责人')
})

test('initSchemas upgrades old default category options to new default options', async () => {
  let savedData: any = null
  const mockPlugin: any = {
    loadData: async () => ({
      version: 1,
      schemas: {
        'custom-category': {
          name: 'custom-category',
          type: 'select',
          label: '分类',
          options: [
            { id: 'work', label: '工作', value: '工作' },
            { id: 'life', label: '生活', value: '生活' },
            { id: 'study', label: '学习', value: '学习' },
            { id: 'project', label: '项目', value: '项目' },
            { id: 'idea', label: '灵感', value: '灵感' },
            { id: 'finance', label: '财务', value: '财务' },
          ],
        },
      },
    }),
    saveData: async (_name: string, payload: any) => {
      savedData = payload
    },
  }

  const { initSchemas } = await import('../src/composables/useAttrSchema.ts')
  await initSchemas(mockPlugin)
  const { getSchema } = useAttrSchema()

  const options = getSchema('custom-category')?.options
  assert.deepEqual(options?.map(o => o.value), ['事实', '疑问', '经验', '方法', '灵感', '信息'])
  assert.deepEqual(savedData?.schemas?.['custom-category']?.options?.map((o: any) => o.value), ['事实', '疑问', '经验', '方法', '灵感', '信息'])
})

test('initSchemas does not call saveData when stored schemas already match', async () => {
  const { DEFAULT_PRESET_SCHEMAS } = await import('../src/constants/schema.ts')
  let saveCount = 0
  const mockPlugin: any = {
    loadData: async () => ({
      version: 1,
      schemas: JSON.parse(JSON.stringify(DEFAULT_PRESET_SCHEMAS)),
    }),
    saveData: async () => {
      saveCount++
    },
  }

  const { initSchemas, reloadSchemas, useAttrSchema } = await import('../src/composables/useAttrSchema.ts')
  await initSchemas(mockPlugin)
  assert.equal(saveCount, 0, 'initSchemas must not call saveData when stored schemas already contain all defaults')

  // reloadSchemas updates schemas in place without saveData
  mockPlugin.loadData = async () => ({
    version: 1,
    schemas: {
      ...DEFAULT_PRESET_SCHEMAS,
      'custom-remote-added': { name: 'custom-remote-added', type: 'text' },
    },
  })
  await reloadSchemas()
  const { getSchema } = useAttrSchema()
  assert.equal(getSchema('custom-remote-added')?.type, 'text')
  assert.equal(saveCount, 0, 'reloadSchemas must not trigger saveData')
})



