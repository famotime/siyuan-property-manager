import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PRESET_SCHEMAS } from '../src/constants/schema.ts'
import { DEFAULT_PRESET_TEMPLATES } from '../src/constants/presetTemplates.ts'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '../src/constants/attrs.ts'

test('DEFAULT_PRESET_SCHEMAS - keys and schemas are well-formed and unified', () => {
  const keys = Object.keys(DEFAULT_PRESET_SCHEMAS)
  assert.ok(keys.length >= 60, `expected at least 60 preset schemas, got ${keys.length}`)

  // 必须保持 custom-tags 不在预设中（有历史迁移至 custom-category），而由 custom-labels 承接
  assert.equal('custom-tags' in DEFAULT_PRESET_SCHEMAS, false, 'custom-tags must not be in preset schemas')
  assert.equal(DEFAULT_PRESET_SCHEMAS['custom-labels']?.type, 'multi-select', 'custom-labels must be multi-select')

  const validTypes = new Set(['text', 'number', 'select', 'multi-select', 'date', 'checkbox', 'block-ref'])

  for (const [key, schema] of Object.entries(DEFAULT_PRESET_SCHEMAS)) {
    // 键名前缀与合法性
    assert.ok(key.startsWith(CUSTOM_KEY_PREFIX), `Key ${key} must start with ${CUSTOM_KEY_PREFIX}`)
    const suffix = key.slice(CUSTOM_KEY_PREFIX.length)
    assert.ok(isValidCustomSuffix(suffix), `Suffix ${suffix} of ${key} must be valid`)
    assert.equal(schema.name, key, `Schema name must match key for ${key}`)

    // 命名规范：全小写 kebab-case，不包含大写字母
    assert.equal(key, key.toLowerCase(), `Key ${key} must be lowercase`)
    assert.ok(!key.includes(' '), `Key ${key} must not contain spaces`)

    // 类型与中文标签
    assert.ok(validTypes.has(schema.type), `Schema ${key} has invalid type: ${schema.type}`)
    assert.ok(typeof schema.label === 'string' && schema.label.trim().length > 0, `Schema ${key} must have label`)

    // 选项合规性（若存在 options）
    if (schema.options) {
      assert.ok(Array.isArray(schema.options), `Options for ${key} must be array`)
      assert.ok(schema.options.length > 0, `Options for ${key} should not be empty`)
      const seenIds = new Set<string>()
      const seenValues = new Set<string>()
      for (const opt of schema.options) {
        assert.ok(opt.id, `Option in ${key} must have id`)
        assert.ok(opt.label, `Option in ${key} must have label`)
        assert.ok(opt.value, `Option in ${key} must have value`)
        assert.ok(!seenIds.has(opt.id), `Duplicate option id ${opt.id} in ${key}`)
        assert.ok(!seenValues.has(opt.value), `Duplicate option value ${opt.value} in ${key}`)
        seenIds.add(opt.id)
        seenValues.add(opt.value)
      }
    }

    // 数字格式合法性
    if (schema.numberFormat) {
      assert.ok(['number', 'currency', 'percent'].includes(schema.numberFormat))
    }
  }
})

test('DEFAULT_PRESET_TEMPLATES - definitions are normalized and complete', () => {
  assert.equal(DEFAULT_PRESET_TEMPLATES.length, 4, 'expected exactly 4 preset templates: area, project, task, note')

  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (const tpl of DEFAULT_PRESET_TEMPLATES) {
    assert.ok(tpl.id, 'Template must have id')
    assert.ok(!seenIds.has(tpl.id), `Duplicate template id ${tpl.id}`)
    seenIds.add(tpl.id)

    assert.ok(tpl.name, 'Template must have name')
    assert.ok(!seenNames.has(tpl.name), `Duplicate template name ${tpl.name}`)
    seenNames.add(tpl.name)

    assert.ok(Array.isArray(tpl.attrs) && tpl.attrs.length > 0, `Template ${tpl.name} must have attrs`)

    for (const attr of tpl.attrs) {
      assert.ok(attr.key, `Attr key in ${tpl.name} must not be empty`)
      // 模板中存储的属性名必须已规范化，不带 custom- 前缀
      assert.ok(!attr.key.startsWith(CUSTOM_KEY_PREFIX), `Template attr key ${attr.key} must not start with custom-`)
      assert.ok(isValidCustomSuffix(attr.key), `Template attr key ${attr.key} must be valid custom suffix`)

      // 对应的 custom-${key} 必须在 DEFAULT_PRESET_SCHEMAS 中有预设定义
      const fullKey = CUSTOM_KEY_PREFIX + attr.key
      assert.ok(fullKey in DEFAULT_PRESET_SCHEMAS, `Template attr ${attr.key} should match a preset schema ${fullKey}`)
    }
  }
})
