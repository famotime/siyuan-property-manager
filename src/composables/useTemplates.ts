/**
 * 自定义属性模板管理。
 *
 * 模板持久化在 localStorage（key = `spm.templates`），
 * 所有变更通过 deep watch 自动回写，无需手动 save。
 */

import type { Plugin } from 'siyuan'
import { ref, watch } from 'vue'
import { isValidCustomSuffix } from '@/constants/attrs'

export interface AttrTemplateItem {
  key: string
  value: string
}

export interface AttrTemplate {
  id: string
  name: string
  attrs: AttrTemplateItem[]
  open: boolean
}

const DEBOUNCE_MS = 300
export const TEMPLATES_STORAGE_NAME = 'templates.json'

const templates = ref<AttrTemplate[]>([])
let counter = 0
let isLoaded = false
let currentPlugin: Plugin | null = null

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

  isLoaded = true
}

async function saveAllData() {
  if (!currentPlugin || !isLoaded)
    return
  try {
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
    if (!key || !isValidCustomSuffix(key))
      return 'invalidKey'
    const tpl = templates.value.find(t => t.id === id)
    if (!tpl)
      return 'notFound'
    if (tpl.attrs.some(a => a.key === key))
      return 'duplicate'
    tpl.attrs.push({ key, value })
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
  }
}
