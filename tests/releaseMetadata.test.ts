import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { SETTINGS_STORAGE_NAME } from '../src/settings.ts'
import { TEMPLATES_STORAGE_NAME } from '../src/composables/useTemplates.ts'
import { TYPES_SCHEMA_STORAGE_NAME } from '../src/constants/schema.ts'

const pluginJson = JSON.parse(readFileSync(new URL('../plugin.json', import.meta.url), 'utf8'))
const license = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8')

test('release metadata disables publish mode and avoids redundant fields', () => {
  assert.equal(pluginJson.disabledInPublish, true)
  assert.equal(pluginJson.funding, undefined)
  assert.equal(pluginJson.displayName.en_US, undefined)
  assert.equal(pluginJson.description.en_US, undefined)
})

test('license uses current release year and actual author', () => {
  assert.match(license, /Copyright \(c\) 2026 Quincy Zou/)
})

test('persistent storage keys are exported for uninstall cleanup', () => {
  assert.equal(SETTINGS_STORAGE_NAME, 'settings')
  assert.equal(TEMPLATES_STORAGE_NAME, 'templates.json')
  assert.equal(TYPES_SCHEMA_STORAGE_NAME, 'types-schema.json')
})
