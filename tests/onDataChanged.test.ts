import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('PropertyManagerPlugin declares onDataChanged to prevent SiYuan force-reloading plugin', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const indexPath = path.join(__dirname, '../src/index.ts')
  const content = fs.readFileSync(indexPath, 'utf8')

  assert.ok(content.includes('async onDataChanged('), 'index.ts must declare onDataChanged()')
  assert.ok(content.includes('reloadTemplates()'), 'onDataChanged must invoke reloadTemplates()')
  assert.ok(content.includes('reloadSchemas()'), 'onDataChanged must invoke reloadSchemas()')
  assert.ok(content.includes('this.lastSavedSettingsJson'), 'index.ts must track lastSavedSettingsJson')
})
