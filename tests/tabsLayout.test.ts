import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('i18n tab titles are simplified and include database tab', () => {
  const zhPath = path.join(__dirname, '../src/i18n/zh_CN.json')
  const enPath = path.join(__dirname, '../src/i18n/en_US.json')

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'))
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

  assert.equal(zh.tabEdit, '编辑')
  assert.equal(zh.tabStats, '统计')
  assert.equal(zh.tabDatabase, '数据库')

  assert.equal(en.tabEdit, 'Edit')
  assert.equal(en.tabStats, 'Stats')
  assert.equal(en.tabDatabase, 'Database')
})

test('PropertyPanel mounts edit, stats, and database tabs', () => {
  const panelPath = path.join(__dirname, '../src/components/PropertyPanel.vue')
  const content = fs.readFileSync(panelPath, 'utf8')

  assert.ok(content.includes("t('tabEdit')"), 'PropertyPanel must render tabEdit')
  assert.ok(content.includes("t('tabStats')"), 'PropertyPanel must render tabStats')
  assert.ok(content.includes("t('tabDatabase')"), 'PropertyPanel must render tabDatabase')
  assert.ok(content.includes('import AttrDatabase from \'./AttrDatabase.vue\''), 'PropertyPanel must import AttrDatabase')
  assert.ok(content.includes('<AttrDatabase'), 'PropertyPanel must mount AttrDatabase')
})

test('AttrStats only retains doc and notebook attribute statistics', () => {
  const statsPath = path.join(__dirname, '../src/components/AttrStats.vue')
  const content = fs.readFileSync(statsPath, 'utf8')

  assert.ok(content.includes('DocCustomStats'), 'AttrStats must include DocCustomStats')
  assert.ok(content.includes('NotebookAttrStats'), 'AttrStats must include NotebookAttrStats')
  assert.ok(!content.includes('AttrTemplateGroups'), 'AttrStats must not include AttrTemplateGroups')
  assert.ok(!content.includes('NotebookDbStats'), 'AttrStats must not include NotebookDbStats')
})

test('AttrDatabase mounts template groups and notebook database stats', () => {
  const dbPath = path.join(__dirname, '../src/components/AttrDatabase.vue')
  const content = fs.readFileSync(dbPath, 'utf8')

  assert.ok(content.includes('AttrTemplateGroups'), 'AttrDatabase must include AttrTemplateGroups')
  assert.ok(content.includes('NotebookDbStats'), 'AttrDatabase must include NotebookDbStats')
})
