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
  assert.deepEqual(getRuntimeSettings(), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
  })
})

test('settings normalization only enables attr stats debug log from true boolean', () => {
  assert.deepEqual(normalizeSettings(null), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
  })
  assert.deepEqual(normalizeSettings({}), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
  })
  assert.deepEqual(normalizeSettings({ enableAttrStatsDebugLog: 'true' }), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
  })
  assert.deepEqual(normalizeSettings({ enableAttrStatsDebugLog: true }), {
    enableAttrStatsDebugLog: true,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
  })
  assert.deepEqual(normalizeSettings({ attrStatsSortBy: 'values', attrStatsSortOrder: 'desc' }), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'values',
    attrStatsSortOrder: 'desc',
  })
})

test('createSettingItemDescriptors builds schema manager and switch items with correct classes and fallbacks', async () => {
  if (typeof (globalThis as any).document === 'undefined') {
    ;(globalThis as any).document = {
      createElement: (tag: string) => {
        const listeners: Record<string, Function[]> = {}
        const style: Record<string, string> = {}
        return {
          tagName: tag.toUpperCase(),
          className: '',
          type: '',
          checked: false,
          textContent: '',
          style: {
            ...style,
            setProperty: (k: string, v: string) => {
              style[k] = v
            },
          },
          addEventListener: (evt: string, cb: Function) => {
            listeners[evt] = listeners[evt] || []
            listeners[evt].push(cb)
          },
          dispatchEvent: (evt: { type: string }) => {
            listeners[evt.type]?.forEach(fn => fn(evt))
          },
        } as any
      },
    }
  }

  const { createSettingItemDescriptors } = await import('../src/settings.ts')

  let schemaManagerOpened = false
  let savedData: any = null

  const hostZh = {
    i18n: {
      settingSchemaTitle: '全局属性类型管理',
      settingSchemaDesc: '集中配置自定义属性的数据类型与选项池。',
      settingSchemaManageBtn: '打开管理面板',
      settingAttrStatsLogTitle: '属性统计日志',
      settingAttrStatsLogDesc: '开启后在开发者工具 Console 输出属性统计诊断日志，默认关闭。',
    },
    openSchemaManager: () => {
      schemaManagerOpened = true
    },
    saveSettings: (data: any) => {
      savedData = data
    },
  }

  const itemsZh = createSettingItemDescriptors(hostZh)
  assert.equal(itemsZh.length, 2)

  // Item 1: Schema Manager
  assert.equal(itemsZh[0].title, '全局属性类型管理')
  assert.equal(itemsZh[0].description, '集中配置自定义属性的数据类型与选项池。')
  assert.equal(itemsZh[0].direction, 'column')
  const btnEl = itemsZh[0].createActionElement() as any
  assert.equal(btnEl.tagName, 'BUTTON')
  assert.equal(btnEl.className, 'b3-button b3-button--outline')
  assert.equal(btnEl.textContent, '打开管理面板')
  btnEl.dispatchEvent({ type: 'click' })
  assert.equal(schemaManagerOpened, true)

  // Item 2: Debug log switch
  assert.equal(itemsZh[1].title, '属性统计日志')
  assert.equal(itemsZh[1].description, '开启后在开发者工具 Console 输出属性统计诊断日志，默认关闭。')
  assert.equal(itemsZh[1].direction, 'column')
  const switchEl = itemsZh[1].createActionElement() as any
  assert.equal(switchEl.tagName, 'INPUT')
  assert.equal(switchEl.type, 'checkbox')
  // Crucial requirement: switch item must have b3-switch class
  assert.match(switchEl.className, /b3-switch/)
  assert.match(switchEl.className, /fn__flex-center/)
  switchEl.checked = true
  switchEl.dispatchEvent({ type: 'change' })
  assert.deepEqual(savedData, { enableAttrStatsDebugLog: true })

  // Fallback test when i18n is empty
  const hostEmpty = {
    i18n: {},
    openSchemaManager: () => {},
    saveSettings: () => {},
  }
  const itemsFallback = createSettingItemDescriptors(hostEmpty)
  assert.equal(itemsFallback[0].title, '全局属性类型管理')
  assert.equal(itemsFallback[0].description, '集中配置自定义属性的数据类型与选项池。')
  assert.equal(itemsFallback[1].title, '属性统计日志')
  assert.equal(itemsFallback[1].description, '开启后在开发者工具 Console 输出属性统计诊断日志，默认关闭。')
})
