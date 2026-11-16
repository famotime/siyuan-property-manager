import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PRESET_SCHEMAS } from '../src/constants/schema.ts'
import { SCHEMA_GROUP_DEFS, groupSchemas } from '../src/constants/schemaGroups.ts'
import { matchQuery } from '../src/utils/autocomplete.ts'
import type { AttrSchemaItem } from '../src/types/schema.d.ts'

test('SCHEMA_GROUP_DEFS - covers all preset schemas without duplicates or omissions', () => {
  const allGroupKeys = new Set<string>()
  const presetKeys = Object.keys(DEFAULT_PRESET_SCHEMAS)

  for (const group of SCHEMA_GROUP_DEFS) {
    assert.ok(group.id, 'Group must have id')
    assert.ok(group.labelKey, 'Group must have labelKey')
    assert.ok(group.defaultLabel, 'Group must have defaultLabel')
    assert.ok(group.keys.length > 0, `Group ${group.id} must have keys`)

    for (const key of group.keys) {
      assert.ok(!allGroupKeys.has(key), `Duplicate key ${key} across schema groups`)
      allGroupKeys.add(key)
      assert.ok(key in DEFAULT_PRESET_SCHEMAS, `Key ${key} in group ${group.id} must exist in DEFAULT_PRESET_SCHEMAS`)
    }
  }

  // 验证预设属性中每一个 key 都被收纳进某个预设分组
  for (const key of presetKeys) {
    assert.ok(allGroupKeys.has(key), `Preset schema ${key} is missing from all schema groups`)
  }

  assert.equal(allGroupKeys.size, presetKeys.length, 'All preset schemas should be partitioned exactly')
})

test('groupSchemas - partitions schemas into groups and collects user custom attributes', () => {
  const mockSchemas: Record<string, AttrSchemaItem> = {
    ...DEFAULT_PRESET_SCHEMAS,
    'custom-my-extra-1': {
      name: 'custom-my-extra-1',
      type: 'text',
      label: '我的自定义属性1',
    },
    'custom-my-extra-2': {
      name: 'custom-my-extra-2',
      type: 'select',
      label: '我的自定义属性2',
      options: [{ id: 'opt1', label: '选项1', value: '选项1' }],
    },
  }

  const sections = groupSchemas(mockSchemas)
  assert.ok(sections.length >= 11, 'Should have 10 preset groups + 1 custom group')

  const customGroup = sections.find(s => s.id === 'custom')
  assert.ok(customGroup, 'Custom group must exist when non-preset attributes exist')
  assert.equal(customGroup.items.length, 2)
  assert.ok(customGroup.items.some(i => i.name === 'custom-my-extra-1'))
  assert.ok(customGroup.items.some(i => i.name === 'custom-my-extra-2'))
})

test('groupSchemas - search matching behavior on key, label, pinyin and options', () => {
  function matchSchema(item: AttrSchemaItem, q: string): boolean {
    if (!q) return true
    if (matchQuery(item.name, q).matched) return true
    const rawKey = item.name.startsWith('custom-') ? item.name.slice(7) : item.name
    if (matchQuery(rawKey, q).matched) return true
    if (item.label && matchQuery(item.label, q).matched) return true
    if (item.options) {
      for (const opt of item.options) {
        if (opt.label && matchQuery(opt.label, q).matched) return true
        if (opt.value && matchQuery(opt.value, q).matched) return true
      }
    }
    return false
  }

  const statusSchema = DEFAULT_PRESET_SCHEMAS['custom-status']
  assert.ok(statusSchema)

  // 1. 英文键名匹配
  assert.ok(matchSchema(statusSchema, 'status'))
  assert.ok(matchSchema(statusSchema, 'custom-status'))
  assert.ok(matchSchema(statusSchema, 'stat'))

  // 2. 中文标签匹配
  assert.ok(matchSchema(statusSchema, '状态'))
  assert.ok(matchSchema(statusSchema, '状'))

  // 3. 拼音首字母匹配
  assert.ok(matchSchema(statusSchema, 'zt'))

  // 4. 枚举选项值匹配（如“进行中”或拼音“jxz”）
  assert.ok(matchSchema(statusSchema, '进行中'))
  assert.ok(matchSchema(statusSchema, 'jxz'))
  assert.ok(matchSchema(statusSchema, '待办'))
  assert.ok(matchSchema(statusSchema, 'db'))

  // 5. 无关搜索不匹配
  assert.ok(!matchSchema(statusSchema, '天气'))
  assert.ok(!matchSchema(statusSchema, 'xyz123'))
})
