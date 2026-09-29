import test from 'node:test'
import assert from 'node:assert/strict'
import {
  _setAutocompleteCacheForTest,
  matchQuery,
  registerCustomKey,
  setAutocompleteSchemaResolver,
  suggestCustomKeys,
  suggestCustomValues,
} from '../src/utils/autocomplete.ts'

test('matchQuery matches exact, prefix, substring, and pinyin', () => {
  assert.equal(matchQuery('status', 'status').matched, true)
  assert.equal(matchQuery('status', 'sta').matched, true)
  assert.equal(matchQuery('project_status', 'stat').matched, true)
  assert.equal(matchQuery('进行中', 'jxz').matched, true)
  assert.equal(matchQuery('状态', 'zt').matched, true)
  assert.equal(matchQuery('abc', 'xyz').matched, false)
})

test('suggestCustomKeys returns ranked matching keys from cache', () => {
  _setAutocompleteCacheForTest(['status', 'state', 'stage', 'priority', 'category'])

  const results = suggestCustomKeys('sta')
  assert.deepEqual(results, ['stage', 'state', 'status'])

  registerCustomKey('custom-star')
  const updated = suggestCustomKeys('star')
  assert.deepEqual(updated, ['star'])
})

test('suggestCustomKeys matches preset attributes by Chinese label and pinyin', () => {
  _setAutocompleteCacheForTest(['category', 'status', 'priority', 'deadline'])

  // 拼音首字母匹配
  const byPinyin = suggestCustomKeys('fl')
  assert.ok(byPinyin.includes('category'))

  // 中文名称精确/子串匹配
  const byChinese = suggestCustomKeys('分类')
  assert.ok(byChinese.includes('category'))

  const statusByZh = suggestCustomKeys('状态')
  assert.ok(statusByZh.includes('status'))
})

test('suggestCustomValues returns matching cached values', async () => {
  _setAutocompleteCacheForTest([], {
    'custom-status': ['In Progress', 'Done', 'Todo', 'Pending'],
  })

  const results = await suggestCustomValues('status', 'in')
  assert.deepEqual(results, ['In Progress', 'Pending'])
})

test('suggestCustomValues returns preset values for preset attributes even without history', async () => {
  _setAutocompleteCacheForTest([])

  // category 的预设值为空 query 时返回全部预设选项
  const categoryValues = await suggestCustomValues('category', '')
  assert.ok(categoryValues.length >= 6)
  assert.equal(categoryValues[0], '工作')
  assert.equal(categoryValues[1], '生活')
  assert.ok(categoryValues.includes('学习'))

  // 支持搜索过滤与拼音匹配
  const filtered = await suggestCustomValues('category', 'sh')
  assert.ok(filtered.includes('生活'))
})

test('suggestCustomKeys matches custom attributes by configured label and pinyin', () => {
  _setAutocompleteCacheForTest(['my_project', 'task_owner'])

  setAutocompleteSchemaResolver((key: string) => {
    if (key === 'custom-my_project')
      return { label: '重点项目' }
    if (key === 'custom-task_owner')
      return { label: '责任人' }
    return undefined
  })

  // 中文精确/子串匹配
  const byZh = suggestCustomKeys('重点')
  assert.ok(byZh.includes('my_project'))

  // 拼音首字母匹配 "zrr" -> 责任人 -> task_owner
  const byPinyin = suggestCustomKeys('zrr')
  assert.ok(byPinyin.includes('task_owner'))

  setAutocompleteSchemaResolver(null)
})

test('suggestCustomValues returns boolean options true/false for boolean attributes', async () => {
  _setAutocompleteCacheForTest([])

  // 1. 预设布尔属性 (custom-archived)
  const archivedValues = await suggestCustomValues('archived', '')
  assert.deepEqual(archivedValues, ['true', 'false'])

  // 2. 搜索过滤
  const filteredT = await suggestCustomValues('archived', 't')
  assert.deepEqual(filteredT, ['true'])

  const filteredF = await suggestCustomValues('archived', 'f')
  assert.deepEqual(filteredF, ['false'])

  // 3. 显式指定 attrType 为 checkbox
  const explicitBool = await suggestCustomValues('is_completed', '', 10, undefined, 'checkbox')
  assert.deepEqual(explicitBool, ['true', 'false'])

  // 4. 自定义 schemaResolver 返回 checkbox 类型
  setAutocompleteSchemaResolver((key: string) => {
    if (key === 'custom-is_ready')
      return { label: '是否就绪', type: 'checkbox' }
    return undefined
  })
  const customBoolValues = await suggestCustomValues('is_ready', '')
  assert.deepEqual(customBoolValues, ['true', 'false'])
  setAutocompleteSchemaResolver(null)
})

