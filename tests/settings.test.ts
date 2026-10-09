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
    avSyncEnabled: true,
    avSyncMode: 'bidirectional',
  })
})

test('settings normalization only enables attr stats debug log from true boolean', () => {
  assert.deepEqual(normalizeSettings(null), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
    avSyncEnabled: true,
    avSyncMode: 'bidirectional',
  })
  assert.deepEqual(normalizeSettings({}), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
    avSyncEnabled: true,
    avSyncMode: 'bidirectional',
  })
  assert.deepEqual(normalizeSettings({ enableAttrStatsDebugLog: 'true' }), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
    avSyncEnabled: true,
    avSyncMode: 'bidirectional',
  })
  assert.deepEqual(normalizeSettings({ enableAttrStatsDebugLog: true }), {
    enableAttrStatsDebugLog: true,
    attrStatsSortBy: 'name',
    attrStatsSortOrder: 'asc',
    avSyncEnabled: true,
    avSyncMode: 'bidirectional',
  })
  assert.deepEqual(normalizeSettings({ attrStatsSortBy: 'values', attrStatsSortOrder: 'desc' }), {
    enableAttrStatsDebugLog: false,
    attrStatsSortBy: 'values',
    attrStatsSortOrder: 'desc',
    avSyncEnabled: true,
    avSyncMode: 'bidirectional',
  })
})

test('settings normalize the av sync switch and direction', () => {
  // 总开关缺省即开启，只有显式 false 才关闭
  assert.equal(normalizeSettings({}).avSyncEnabled, true)
  assert.equal(normalizeSettings({ avSyncEnabled: false }).avSyncEnabled, false)
  assert.equal(normalizeSettings({ avSyncEnabled: 'false' }).avSyncEnabled, true)

  assert.equal(normalizeSettings({ avSyncMode: 'av-to-attr' }).avSyncMode, 'av-to-attr')
  assert.equal(normalizeSettings({ avSyncMode: 'attr-to-av' }).avSyncMode, 'attr-to-av')
  assert.equal(normalizeSettings({ avSyncMode: 'bidirectional' }).avSyncMode, 'bidirectional')
  assert.equal(normalizeSettings({ avSyncMode: 'nonsense' }).avSyncMode, 'bidirectional')
})

test('createSettingItemDescriptors builds schema manager and switch items with correct classes and fallbacks', async () => {
  if (typeof (globalThis as any).document === 'undefined') {
    ;(globalThis as any).document = {
      createElement: (tag: string) => {
        const listeners: Record<string, Function[]> = {}
        const style: Record<string, string> = {}
        const children: any[] = []
        const element: any = {
          tagName: tag.toUpperCase(),
          className: '',
          type: '',
          checked: false,
          selected: false,
          value: '',
          textContent: '',
          children,
          get options() {
            return children
          },
          appendChild: (child: any) => {
            children.push(child)
            return child
          },
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
        }
        return element
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
  assert.equal(itemsZh.length, 4)

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

  // Item 3: attribute ⇄ database sync master switch, defaults to on
  assert.equal(itemsZh[2].title, '属性 ⇄ 数据库双向同步')
  const syncSwitchEl = itemsZh[2].createActionElement() as any
  assert.equal(syncSwitchEl.tagName, 'INPUT')
  assert.equal(syncSwitchEl.type, 'checkbox')
  assert.equal(syncSwitchEl.checked, true)
  assert.match(syncSwitchEl.className, /b3-switch/)
  syncSwitchEl.checked = false
  syncSwitchEl.dispatchEvent({ type: 'change' })
  assert.deepEqual(savedData, { avSyncEnabled: false })

  // Item 4: sync direction select with the three supported modes
  assert.equal(itemsZh[3].title, '同步方向')
  const modeEl = itemsZh[3].createActionElement() as any
  assert.equal(modeEl.tagName, 'SELECT')
  assert.match(modeEl.className, /b3-select/)
  assert.deepEqual(
    modeEl.options.map((option: any) => option.value),
    ['bidirectional', 'av-to-attr', 'attr-to-av'],
  )
  assert.equal(modeEl.options[0].selected, true)
  modeEl.value = 'av-to-attr'
  modeEl.dispatchEvent({ type: 'change' })
  assert.deepEqual(savedData, { avSyncMode: 'av-to-attr' })

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
  assert.equal(itemsFallback[2].title, '属性 ⇄ 数据库双向同步')
  assert.equal(itemsFallback[3].title, '同步方向')
})
