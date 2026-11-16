import test from 'node:test'
import assert from 'node:assert/strict'
import { disposeSchemas, initSchemas, reloadSchemas, useAttrSchema } from '../src/composables/useAttrSchema.ts'
import { disposeTemplates, initTemplates, reloadTemplates, useTemplates } from '../src/composables/useTemplates.ts'

// SM-105：防抖保存窗口内到达的多端广播（onDataChanged → reload*）不得覆盖
// 内存中尚未落盘的本地编辑。dirty 门闩保证「本地优先」，保存成功后由
// 本次保存触发的下一次广播自然对齐。
//
// 说明：useAvSync 的登记表脏标记与此处 schema/templates 完全同构
// （scheduleRegistrySave 置脏 / saveRegistry 成功清脏 / reloadAvSync 脏时跳过），
// 但该模块经 @/api 依赖 types-only 的 siyuan 包，无法在 tsx 单测中导入，
// 故靠同构对称覆盖。

test('reloadSchemas skips overwrite while local schema edits are pending', async () => {
  let saveCount = 0
  let lastSaved: any = null
  const mockPlugin: any = {
    loadData: async () => ({
      version: 1,
      schemas: { 'custom-mine': { name: 'custom-mine', type: 'text' } },
    }),
    saveData: async (_name: string, data: any) => {
      saveCount++
      lastSaved = data
    },
  }

  await initSchemas(mockPlugin)
  const { setAttrType, getSchema } = useAttrSchema()
  setAttrType('custom-mine', 'number')

  // 另一客户端广播到达（远端内容与本地不同）
  mockPlugin.loadData = async () => ({
    version: 1,
    schemas: { 'custom-remote': { name: 'custom-remote', type: 'select' } },
  })
  await reloadSchemas()
  assert.equal(getSchema('custom-remote'), undefined, 'dirty 期间远端覆盖被跳过')
  assert.equal(getSchema('custom-mine')?.type, 'number', '本地未落盘编辑保留')

  // 防抖窗口结束后本地编辑落盘
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.equal(saveCount, 1)
  assert.equal(lastSaved?.schemas?.['custom-mine']?.type, 'number')

  disposeSchemas()
})

test('reloadTemplates skips overwrite while local template edits are pending', async () => {
  const saved: any[] = []
  const mockPlugin: any = {
    loadData: async () => ({
      templates: [{ id: 'tpl-a', name: 'A', attrs: [], open: true }],
      counter: 1,
    }),
    saveData: async (_name: string, data: any) => {
      saved.push(data)
    },
  }

  await initTemplates(mockPlugin)
  const { addTemplate, templates } = useTemplates()
  addTemplate('X')
  // deep watch 异步触发 triggerSave → 置脏
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.ok(templates.value.some(tpl => tpl.name.startsWith('X')))

  mockPlugin.loadData = async () => ({
    templates: [{ id: 'tpl-remote', name: 'Remote', attrs: [], open: false }],
    counter: 9,
  })
  await reloadTemplates()
  assert.equal(templates.value.some(tpl => tpl.id === 'tpl-remote'), false, 'dirty 期间远端覆盖被跳过')

  await new Promise(resolve => setTimeout(resolve, 350))
  const last = saved.at(-1)
  assert.ok(last, '防抖保存已落地')
  assert.ok(last.templates.some((tpl: any) => tpl.name.startsWith('X')))

  disposeTemplates()
})
