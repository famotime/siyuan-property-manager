import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_SETTINGS,
  getRuntimeSettings,
  isAttrStatsDebugLogEnabled,
  normalizeSettings,
  setRuntimeSettings,
} from '../src/settings.ts'

test('settings default disables attr stats debug log', () => {
  setRuntimeSettings(DEFAULT_SETTINGS)

  assert.equal(isAttrStatsDebugLogEnabled(), false)
  assert.deepEqual(getRuntimeSettings(), { enableAttrStatsDebugLog: false })
})

test('settings normalization only enables attr stats debug log from true boolean', () => {
  assert.deepEqual(normalizeSettings(null), { enableAttrStatsDebugLog: false })
  assert.deepEqual(normalizeSettings({}), { enableAttrStatsDebugLog: false })
  assert.deepEqual(normalizeSettings({ enableAttrStatsDebugLog: 'true' }), { enableAttrStatsDebugLog: false })
  assert.deepEqual(normalizeSettings({ enableAttrStatsDebugLog: true }), { enableAttrStatsDebugLog: true })
})
