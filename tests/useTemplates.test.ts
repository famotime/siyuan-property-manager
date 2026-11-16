import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'

// 模拟 window.localStorage，因为 useTemplates 会在顶层导入或 initTemplates 中访问
const mockLocalStorage: Record<string, string> = {}
global.window = {
  localStorage: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockLocalStorage[key] = String(value)
    },
    removeItem: (key: string) => {
      delete mockLocalStorage[key]
    },
    clear: () => {
      for (const k in mockLocalStorage) {
        delete mockLocalStorage[k]
      }
    },
    length: 0,
    key: (index: number) => null,
  },
} as any

import { initTemplates, useTemplates } from '../src/composables/useTemplates.ts'

// 模拟 siyuan 的 Plugin
function createMockPlugin() {
  const dataStore: Record<string, any> = {}
  return {
    loadData: async (path: string) => {
      return dataStore[path] || null
    },
    saveData: async (path: string, data: any) => {
      dataStore[path] = JSON.parse(JSON.stringify(data))
    },
    _store: dataStore,
  } as any
}

test('useTemplates - initTemplates loads from plugin data if available', async () => {
  const plugin = createMockPlugin()
  plugin._store['templates.json'] = {
    templates: [
      { id: 'tpl1', name: 'Test Template', attrs: [{ key: 'my-attr', value: 'hello' }], open: true }
    ],
    counter: 5
  }

  await initTemplates(plugin)
  const { templates } = useTemplates()

  assert.equal(templates.value.length, 1)
  assert.equal(templates.value[0].name, 'Test Template')
  assert.equal(templates.value[0].attrs[0].key, 'my-attr')
})

test('useTemplates - initTemplates migrates from localStorage if plugin data is empty', async () => {
  const plugin = createMockPlugin()
  
  // 准备 localStorage 数据
  mockLocalStorage['spm.templates'] = JSON.stringify([
    { id: 'tpl-ls', name: 'LS Template', attrs: [{ key: 'ls-attr', value: 'world' }], open: false }
  ])
  mockLocalStorage['spm.templates.counter'] = '10'

  await initTemplates(plugin)
  const { templates } = useTemplates()

  assert.equal(templates.value.length, 1)
  assert.equal(templates.value[0].name, 'LS Template')
  
  // 验证是否迁移保存到了 templates.json
  // 由于有防抖，我们稍等或者检查 saveAllData 是否在 initTemplates 后立即同步调用了（当 !loaded && templates.value.length > 0 时，有 `void saveAllData()` 直接调用，但不防抖）
  assert.ok(plugin._store['templates.json'])
  assert.equal(plugin._store['templates.json'].counter, 10)
  assert.equal(plugin._store['templates.json'].templates[0].id, 'tpl-ls')
})

test('useTemplates - CRUD actions and watch auto-save', async () => {
  const plugin = createMockPlugin()
  plugin._store['templates.json'] = {
    templates: [],
    counter: 0
  }

  await initTemplates(plugin)
  const {
    templates,
    addTemplate,
    createFromAttrs,
    removeTemplate,
    renameTemplate,
    toggleTemplate,
    addTemplateAttr,
    removeTemplateAttr,
    updateTemplateAttr
  } = useTemplates()

  // 1. 添加模板
  const tpl = addTemplate('Prefix')
  assert.equal(tpl.name, 'Prefix1')
  assert.equal(templates.value.length, 1)

  // 2. 修改模板名和展开状态
  renameTemplate(tpl.id, 'New Name')
  assert.equal(tpl.name, 'New Name')

  toggleTemplate(tpl.id)
  assert.equal(tpl.open, false)

  // 3. 添加/更新/删除模板属性
  // 无效键应该失败
  let err = addTemplateAttr(tpl.id, 'invalid key!', 'val')
  assert.equal(err, 'invalidKey')

  // 有效键应该成功
  err = addTemplateAttr(tpl.id, 'attr1', 'val1')
  assert.equal(err, null)
  assert.equal(tpl.attrs.length, 1)
  assert.equal(tpl.attrs[0].key, 'attr1')
  assert.equal(tpl.attrs[0].value, 'val1')

  // 重复键应该失败
  err = addTemplateAttr(tpl.id, 'attr1', 'val2')
  assert.equal(err, 'duplicate')

  // 修改属性值
  updateTemplateAttr(tpl.id, 0, 'val1-updated')
  assert.equal(tpl.attrs[0].value, 'val1-updated')

  // 4. 从属性创建新模板
  const newTpl = createFromAttrs('AttrsTpl', [{ key: 'attr2', value: 'val2' }])
  assert.equal(newTpl.name, 'AttrsTpl')
  assert.equal(newTpl.attrs.length, 1)
  assert.equal(newTpl.attrs[0].key, 'attr2')
  assert.equal(templates.value.length, 2)

  // 5. 校验防抖保存
  // 等待 400ms，以满足 useTemplates.ts 中的 DEBOUNCE_MS = 300
  await new Promise(resolve => setTimeout(resolve, 400))
  
  assert.ok(plugin._store['templates.json'])
  // 此时 counter 应为 2 (添加过 Prefix1，和 AttrsTpl，各自递增了 counter)
  assert.equal(plugin._store['templates.json'].counter, 2)
  assert.equal(plugin._store['templates.json'].templates.length, 2)

  // 6. 删除属性
  removeTemplateAttr(tpl.id, 0)
  assert.equal(tpl.attrs.length, 0)

  // 7. 删除模板
  removeTemplate(tpl.id)
  assert.equal(templates.value.length, 1)
  assert.equal(templates.value[0].id, newTpl.id)
})

test('useTemplates - loadPresetTemplates incrementally loads and deduplicates presets with normalized keys', async () => {
  const plugin = createMockPlugin()
  plugin._store['templates.json'] = {
    templates: [],
    counter: 0,
  }

  await initTemplates(plugin)
  const { templates, loadPresetTemplates } = useTemplates()

  // 1. 首次载入预设
  const firstRes = loadPresetTemplates()
  assert.equal(firstRes.addedCount, 4)
  assert.equal(firstRes.skippedCount, 0)
  assert.equal(templates.value.length, 4)

  // 验证预设模板规范化 key 不含 custom- 前缀
  const areaTpl = templates.value.find(t => t.id === 'tpl-area')
  assert.ok(areaTpl)
  assert.equal(areaTpl.name, '领域')
  assert.ok(areaTpl.attrs.some(a => a.key === 'area'))
  assert.ok(areaTpl.attrs.some(a => a.key === 'status' && a.value === '进行中'))

  const projectTpl = templates.value.find(t => t.id === 'tpl-project')
  assert.ok(projectTpl)
  assert.equal(projectTpl.name, '项目')
  assert.ok(projectTpl.attrs.some(a => a.key === 'area'))

  const taskTpl = templates.value.find(t => t.id === 'tpl-task')
  assert.ok(taskTpl)
  assert.equal(taskTpl.name, '任务')
  assert.ok(taskTpl.attrs.some(a => a.key === 'status' && a.value === '待办'))
  assert.ok(taskTpl.attrs.some(a => a.key === 'project'))

  const noteTpl = templates.value.find(t => t.id === 'tpl-note')
  assert.ok(noteTpl)
  assert.equal(noteTpl.name, '笔记')
  assert.ok(noteTpl.attrs.some(a => a.key === 'category' && (a.value === 'Exp（经验）' || a.value === '经验')))
  assert.ok(noteTpl.attrs.some(a => a.key === 'project'))
  assert.ok(noteTpl.attrs.some(a => a.key === 'area'))

  // 验证 description 字段
  assert.ok(areaTpl.description && areaTpl.description.includes('长远愿景'))
  assert.ok(projectTpl.description && projectTpl.description.includes('阶段性规划'))
  assert.ok(taskTpl.description && taskTpl.description.includes('敏捷动作单元'))
  assert.ok(noteTpl.description && noteTpl.description.includes('Log（事实）'))

  assert.ok(templates.value.every(t => t.attrs.every(a => !a.key.startsWith('custom-'))))

  // 2. 再次载入预设应全量去重跳过
  const secondRes = loadPresetTemplates()
  assert.equal(secondRes.addedCount, 0)
  assert.equal(secondRes.skippedCount, 4)
  assert.equal(templates.value.length, 4)
})
