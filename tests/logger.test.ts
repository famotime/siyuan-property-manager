import test from 'node:test'
import assert from 'node:assert/strict'
import { attrStatsDebug, attrStatsError, attrStatsWarn } from '../src/utils/logger.ts'
import { setRuntimeSettings } from '../src/settings.ts'

test('attr stats logger is silent when setting is disabled', () => {
  setRuntimeSettings({ enableAttrStatsDebugLog: false })
  const calls: string[] = []
  const originalDebug = console.debug
  const originalWarn = console.warn
  const originalError = console.error
  console.debug = () => { calls.push('debug') }
  console.warn = () => { calls.push('warn') }
  console.error = () => { calls.push('error') }

  try {
    attrStatsDebug('debug')
    attrStatsWarn('warn')
    attrStatsError('error')
  }
  finally {
    console.debug = originalDebug
    console.warn = originalWarn
    console.error = originalError
  }

  assert.deepEqual(calls, [])
})

test('attr stats logger writes when setting is enabled', () => {
  setRuntimeSettings({ enableAttrStatsDebugLog: true })
  const calls: string[] = []
  const originalDebug = console.debug
  console.debug = (message?: unknown) => { calls.push(String(message)) }

  try {
    attrStatsDebug('debug')
  }
  finally {
    console.debug = originalDebug
    setRuntimeSettings({ enableAttrStatsDebugLog: false })
  }

  assert.deepEqual(calls, ['[siyuan-property-manager][attr-stats] debug'])
})
