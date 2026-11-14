import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('i18n tab titles and tooltips are configured correctly', () => {
  const zhPath = path.join(__dirname, '../src/i18n/zh_CN.json')
  const enPath = path.join(__dirname, '../src/i18n/en_US.json')

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'))
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

  assert.equal(zh.tabEdit, '当前文档')
  assert.equal(zh.tabStats, '笔记本')
  assert.equal(zh.tabDatabase, '数据库')

  assert.equal(en.tabEdit, 'Current Doc')
  assert.equal(en.tabStats, 'Notebook')
  assert.equal(en.tabDatabase, 'Database')

  assert.ok(zh.tabEditTooltip, 'zh must have tabEditTooltip')
  assert.ok(zh.tabStatsTooltip, 'zh must have tabStatsTooltip')
  assert.ok(zh.tabDatabaseTooltip, 'zh must have tabDatabaseTooltip')
  assert.ok(en.tabEditTooltip, 'en must have tabEditTooltip')
  assert.ok(en.tabStatsTooltip, 'en must have tabStatsTooltip')
  assert.ok(en.tabDatabaseTooltip, 'en must have tabDatabaseTooltip')
})

test('PropertyPanel mounts doc, notebook, and database tabs with tooltips', () => {
  const panelPath = path.join(__dirname, '../src/components/PropertyPanel.vue')
  const content = fs.readFileSync(panelPath, 'utf8')

  assert.ok(content.includes("t('tabEdit')"), 'PropertyPanel must render tabEdit')
  assert.ok(content.includes("t('tabStats')"), 'PropertyPanel must render tabStats')
  assert.ok(content.includes("t('tabDatabase')"), 'PropertyPanel must render tabDatabase')
  assert.ok(content.includes("t('tabEditTooltip')"), 'PropertyPanel must have tabEditTooltip')
  assert.ok(content.includes("t('tabStatsTooltip')"), 'PropertyPanel must have tabStatsTooltip')
  assert.ok(content.includes("t('tabDatabaseTooltip')"), 'PropertyPanel must have tabDatabaseTooltip')
  assert.ok(content.includes('DocCustomStats'), 'PropertyPanel must mount DocCustomStats in Tab 1')
  assert.ok(content.includes('import AttrDatabase from \'./AttrDatabase.vue\''), 'PropertyPanel must import AttrDatabase')
  assert.ok(content.includes('<AttrDatabase'), 'PropertyPanel must mount AttrDatabase')
})

test('AttrStats mounts templates and notebook attribute stats', () => {
  const statsPath = path.join(__dirname, '../src/components/AttrStats.vue')
  const content = fs.readFileSync(statsPath, 'utf8')

  assert.ok(content.includes('AttrTemplates'), 'AttrStats must include AttrTemplates')
  assert.ok(content.includes('NotebookAttrStats'), 'AttrStats must include NotebookAttrStats')
  assert.ok(!content.includes('DocCustomStats'), 'AttrStats must not include DocCustomStats (moved to Tab 1)')
  assert.ok(!content.includes('AttrTemplateGroups'), 'AttrStats must not include AttrTemplateGroups')
  assert.ok(!content.includes('NotebookDbStats'), 'AttrStats must not include NotebookDbStats')
})

test('AttrDatabase mounts template groups and notebook database stats', () => {
  const dbPath = path.join(__dirname, '../src/components/AttrDatabase.vue')
  const content = fs.readFileSync(dbPath, 'utf8')

  assert.ok(content.includes('AttrTemplateGroups'), 'AttrDatabase must include AttrTemplateGroups')
  assert.ok(content.includes('NotebookDbStats'), 'AttrDatabase must include NotebookDbStats')
})

test('NotebookDbStats guards sync toggle when blocksCount is 0 and includes insert button', () => {
  const dbStatsPath = path.join(__dirname, '../src/components/NotebookDbStats.vue')
  const content = fs.readFileSync(dbStatsPath, 'utf8')

  // 同步开关受绑定块数大于0的条件控制
  assert.ok(content.includes('v-if="db.blocksCount > 0"'), 'sync toggle must be conditionally rendered when blocksCount > 0')
  assert.ok(content.includes('v-if="db.blocksCount > 0 && isSyncEnabled(db.id)"'), 'sync row must be conditionally rendered when blocksCount > 0')

  // 插入按钮及处理函数
  assert.ok(content.includes('spm-db-stats__insert-btn'), 'NotebookDbStats must have insert button')
  assert.ok(content.includes('insertDatabaseView(db)'), 'NotebookDbStats must call insertDatabaseView')
  assert.ok(content.includes("t('insertDatabaseToDoc')"), 'NotebookDbStats must use insertDatabaseToDoc translation')

  // i18n 资源文件包含新增的插入键
  const zhPath = path.join(__dirname, '../src/i18n/zh_CN.json')
  const enPath = path.join(__dirname, '../src/i18n/en_US.json')
  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'))
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))

  assert.equal(zh.insertDatabaseToDoc, '插入到当前文档')
  assert.equal(zh.insertDatabaseSuccess, '已成功插入数据库视图')
  assert.equal(en.insertDatabaseToDoc, 'Insert into current doc')
  assert.equal(en.insertDatabaseSuccess, 'Database view inserted successfully')
})

