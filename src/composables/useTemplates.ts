/**
 * 自定义属性模板管理。
 *
 * 模板持久化在 localStorage（key = `spm.templates`），
 * 所有变更通过 deep watch 自动回写，无需手动 save。
 */

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

const STORAGE_KEY = 'spm.templates'
const COUNTER_KEY = 'spm.templates.counter'
const DEBOUNCE_MS = 300

function loadTemplates(): AttrTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed))
      return []
    return parsed as AttrTemplate[]
  }
  catch {
    return []
  }
}

function loadCounter(): number {
  try {
    const raw = window.localStorage.getItem(COUNTER_KEY)
    return raw ? Number(raw) || 0 : 0
  }
  catch {
    return 0
  }
}

function saveTemplates(tpls: AttrTemplate[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tpls))
  }
  catch {
    /* 忽略写入失败 */
  }
}

function saveCounter(n: number) {
  try {
    window.localStorage.setItem(COUNTER_KEY, String(n))
  }
  catch {
    /* 忽略写入失败 */
  }
}

const templates = ref<AttrTemplate[]>(loadTemplates())
let counter = loadCounter()

// deep watch 自动持久化（debounce）
let timer: ReturnType<typeof setTimeout> | null = null
watch(
  templates,
  (val) => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => saveTemplates(val), DEBOUNCE_MS)
  },
  { deep: true },
)

export function useTemplates() {
  function addTemplate(): AttrTemplate {
    counter++
    saveCounter(counter)
    const tpl: AttrTemplate = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: `自定义属性模板${counter}`,
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

  return {
    templates,
    addTemplate,
    removeTemplate,
    renameTemplate,
    toggleTemplate,
    addTemplateAttr,
    removeTemplateAttr,
  }
}
