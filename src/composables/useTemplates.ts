/**
 * 自定义属性模板管理。
 *
 * 模板持久化在 localStorage（key = `spm.templates`），
 * 所有变更通过 deep watch 自动回写，无需手动 save。
 */

import type { Plugin } from 'siyuan'
import { ref, watch } from 'vue'
import { CUSTOM_KEY_PREFIX, isValidCustomSuffix } from '@/constants/attrs'
import { DEFAULT_PRESET_TEMPLATES } from '@/constants/presetTemplates'
import type { PresetTemplate } from '@/constants/presetTemplates'

export interface AttrTemplateItem {
  key: string
  value: string
}

export interface AttrTemplate {
  id: string
  name: string
  attrs: AttrTemplateItem[]
  open: boolean
  description?: string
}

const DEBOUNCE_MS = 300
export const TEMPLATES_STORAGE_NAME = 'templates.json'

function serializeTemplates(items: AttrTemplate[], cnt: number): string {
  return JSON.stringify({ templates: items, counter: cnt })
}

const templates = ref<AttrTemplate[]>([])
let counter = 0
let isLoaded = false
let currentPlugin: Plugin | null = null
let lastSavedTemplatesJson = ''

export async function initTemplates(plugin: Plugin) {
  currentPlugin = plugin
  let loaded = false
  try {
    const data = await plugin.loadData(TEMPLATES_STORAGE_NAME)
    if (data && typeof data === 'object') {
      if (Array.isArray(data.templates)) {
        templates.value = data.templates
        loaded = true
      }
      if (typeof data.counter === 'number') {
        counter = data.counter
      }
    }
  }
  catch {
    // 忽略加载错误
  }

  // 兜底平滑迁移老用户的 localStorage 模板数据
  if (!loaded) {
    try {
      const raw = window.localStorage.getItem('spm.templates')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          templates.value = parsed as AttrTemplate[]
        }
      }
      const rawCounter = window.localStorage.getItem('spm.templates.counter')
      if (rawCounter) {
        counter = Number(rawCounter) || 0
      }
      if (templates.value.length > 0) {
        isLoaded = true
        void saveAllData()
      }
    }
    catch {
      // 忽略迁移错误
    }
  }

  lastSavedTemplatesJson = serializeTemplates(templates.value, counter)
  isLoaded = true
}

export async function reloadTemplates() {
  if (!currentPlugin)
    return
  try {
    const data = await currentPlugin.loadData(TEMPLATES_STORAGE_NAME)
    if (data && typeof data === 'object' && Array.isArray(data.templates)) {
      const nextCounter = typeof data.counter === 'number' ? data.counter : counter
      const nextJson = serializeTemplates(data.templates, nextCounter)
      if (nextJson !== lastSavedTemplatesJson) {
        templates.value = data.templates
        counter = nextCounter
        lastSavedTemplatesJson = nextJson
      }
    }
  }
  catch {
    // 忽略读取错误
  }
}

async function saveAllData() {
  if (!currentPlugin || !isLoaded)
    return
  const nextJson = serializeTemplates(templates.value, counter)
  if (nextJson === lastSavedTemplatesJson)
    return
  try {
    lastSavedTemplatesJson = nextJson
    await currentPlugin.saveData(TEMPLATES_STORAGE_NAME, {
      templates: templates.value,
      counter,
    })
  }
  catch {
    // 忽略写入错误
  }
}
let saveTimer: ReturnType<typeof setTimeout> | null = null
function triggerSave() {
  if (saveTimer)
    clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveAllData()
  }, DEBOUNCE_MS)
}

watch(
  templates,
  () => {
    triggerSave()
  },
  { deep: true },
)

export function useTemplates() {
  function addTemplate(namePrefix?: string): AttrTemplate {
    counter++
    const tpl: AttrTemplate = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: `${namePrefix ?? 'Template'}${counter}`,
      attrs: [],
      open: true,
    }
    templates.value.push(tpl)
    return tpl
  }

  function removeTemplate(id: string) {
    const idx = templates.value.findIndex(t => t.id === id)
    if (idx !== -1)
      templates.value.splice(idx, 1)
  }

  function renameTemplate(id: string, name: string) {
    const tpl = templates.value.find(t => t.id === id)
    if (tpl)
      tpl.name = name
  }

  function toggleTemplate(id: string) {
    const tpl = templates.value.find(t => t.id === id)
    if (tpl)
      tpl.open = !tpl.open
  }

  function addTemplateAttr(id: string, key: string, value: string): string | null {
    const rawSuffix = key.startsWith(CUSTOM_KEY_PREFIX) ? key.slice(CUSTOM_KEY_PREFIX.length) : key
    if (!rawSuffix || !isValidCustomSuffix(rawSuffix))
      return 'invalidKey'
    const tpl = templates.value.find(t => t.id === id)
    if (!tpl)
      return 'notFound'
    if (tpl.attrs.some(a => a.key === rawSuffix))
      return 'duplicate'
    tpl.attrs.push({ key: rawSuffix, value })
    return null
  }

  function removeTemplateAttr(id: string, index: number) {
    const tpl = templates.value.find(t => t.id === id)
    if (tpl && index >= 0 && index < tpl.attrs.length)
      tpl.attrs.splice(index, 1)
  }

  function updateTemplateAttr(id: string, index: number, value: string) {
    const tpl = templates.value.find(t => t.id === id)
    if (tpl && index >= 0 && index < tpl.attrs.length)
      tpl.attrs[index].value = value
  }

  /**
   * 用指定名称和属性列表创建模板（带初始属性）。
   */
  function createFromAttrs(name: string, attrs: AttrTemplateItem[]): AttrTemplate {
    counter++
    const tpl: AttrTemplate = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || `Template${counter}`,
      attrs: attrs.map(a => ({ ...a })),
      open: true,
    }
    templates.value.push(tpl)
    return tpl
  }

  /**
   * 增量载入工作与生活场景预设模板字典。
   * 按 id 或名称去重，跳过已存在的模板，仅追加尚未存在的模板。
   */
  function loadPresetTemplates(customPresets?: PresetTemplate[]): { addedCount: number; skippedCount: number } {
    let addedCount = 0
    let skippedCount = 0
    const list = customPresets || DEFAULT_PRESET_TEMPLATES

    for (const preset of list) {
      const alreadyExists = templates.value.some(
        t => t.id === preset.id || t.name === preset.name,
      )
      if (alreadyExists) {
        skippedCount++
        continue
      }

      counter++
      const newTpl: AttrTemplate = {
        id: preset.id,
        name: preset.name,
        open: preset.open,
        description: preset.description,
        attrs: preset.attrs.map(a => {
          const suffix = a.key.startsWith(CUSTOM_KEY_PREFIX)
            ? a.key.slice(CUSTOM_KEY_PREFIX.length)
            : a.key
          return { key: suffix, value: a.value }
        }),
      }
      templates.value.push(newTpl)
      addedCount++
    }

    return { addedCount, skippedCount }
  }

  /**
   * 在所有模板中批量重命名属性键
   */
  function renameAttrKeyInTemplates(oldKey: string, newKey: string): number {
    const oldSuffix = oldKey.startsWith(CUSTOM_KEY_PREFIX) ? oldKey.slice(CUSTOM_KEY_PREFIX.length) : oldKey
    const newSuffix = newKey.startsWith(CUSTOM_KEY_PREFIX) ? newKey.slice(CUSTOM_KEY_PREFIX.length) : newKey
    let changed = 0
    for (const tpl of templates.value) {
      for (const attr of tpl.attrs) {
        if (attr.key === oldSuffix || attr.key === oldKey) {
          attr.key = newSuffix
          changed++
        }
      }
    }
    return changed
  }

  return {
    templates,
    addTemplate,
    createFromAttrs,
    removeTemplate,
    renameTemplate,
    toggleTemplate,
    addTemplateAttr,
    removeTemplateAttr,
    updateTemplateAttr,
    loadPresetTemplates,
    renameAttrKeyInTemplates,
  }
}
