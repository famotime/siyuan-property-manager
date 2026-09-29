import type { Plugin } from 'siyuan'
import type { AttrOption, AttrSchemaItem, AttrType, TypesSchemaStorage } from '@/types/schema'
import { ref } from 'vue'
import { DEFAULT_PRESET_SCHEMAS, PRESET_TAG_COLORS, TYPES_SCHEMA_STORAGE_NAME } from '@/constants/schema'
import { registerCustomKey, setAutocompleteSchemaResolver } from '@/utils/autocomplete'
import { inferAttrType } from '@/utils/typeInference'

const DEBOUNCE_MS = 300

const schemas = ref<Record<string, AttrSchemaItem>>({})
let isLoaded = false
let currentPlugin: Plugin | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

export async function initSchemas(plugin: Plugin): Promise<void> {
  currentPlugin = plugin
  try {
    const data = (await plugin.loadData(TYPES_SCHEMA_STORAGE_NAME)) as TypesSchemaStorage | undefined
    if (data && typeof data === 'object' && data.schemas && typeof data.schemas === 'object' && Object.keys(data.schemas).length > 0) {
      const loadedSchemas = { ...data.schemas }
      // 平滑兼容历史 custom-tags 到 custom-category，并将 category 规范为单选
      if (loadedSchemas['custom-tags'] && !loadedSchemas['custom-category']) {
        loadedSchemas['custom-category'] = {
          ...loadedSchemas['custom-tags'],
          name: 'custom-category',
          type: 'select',
          label: '分类',
        }
        delete loadedSchemas['custom-tags']
      }
      else if (loadedSchemas['custom-category'] && loadedSchemas['custom-category'].type === 'multi-select') {
        loadedSchemas['custom-category'] = {
          ...loadedSchemas['custom-category'],
          type: 'select',
        }
      }
      // 合并新增的默认预设属性，同时用户自定义配置优先
      schemas.value = {
        ...DEFAULT_PRESET_SCHEMAS,
        ...loadedSchemas,
      }
      await saveAllSchemas()
    }
    else {
      // 首次使用或存储为空时，以默认预设集合初始化并持久化
      schemas.value = JSON.parse(JSON.stringify(DEFAULT_PRESET_SCHEMAS))
      await saveAllSchemas()
    }
  }
  catch {
    schemas.value = JSON.parse(JSON.stringify(DEFAULT_PRESET_SCHEMAS))
  }
  isLoaded = true
  setAutocompleteSchemaResolver((key: string) => schemas.value[key])
  for (const k of Object.keys(schemas.value)) {
    registerCustomKey(k)
  }
}

async function saveAllSchemas(): Promise<void> {
  if (!currentPlugin || !isLoaded)
    return
  try {
    const payload: TypesSchemaStorage = {
      version: 1,
      schemas: schemas.value,
    }
    await currentPlugin.saveData(TYPES_SCHEMA_STORAGE_NAME, payload)
  }
  catch {
    // 忽略写入异常
  }
}

function triggerSave(): void {
  if (saveTimer)
    clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveAllSchemas()
  }, DEBOUNCE_MS)
}

function notifySchemaChanged(key?: string): void {
  if (typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('spm:schema-changed', { detail: { key } }),
    )
  }
}

// 供单元测试重置状态使用
export function _resetSchemasForTest(initial: Record<string, AttrSchemaItem> = {}): void {
  schemas.value = { ...initial }
  isLoaded = true
}

export function useAttrSchema() {
  function getSchema(key: string): AttrSchemaItem | undefined {
    return schemas.value[key]
  }

  function resolveAttrType(key: string, value: string): AttrType {
    const configured = schemas.value[key]
    if (configured?.type)
      return configured.type
    return inferAttrType(key, value)
  }

  function setAttrType(key: string, type: AttrType, label?: string): AttrSchemaItem {
    const existing = schemas.value[key] ?? { name: key, type: 'text' }
    const next: AttrSchemaItem = {
      ...existing,
      name: key,
      type,
      ...(label !== undefined ? { label: label.trim() || undefined } : {}),
    }
    schemas.value = { ...schemas.value, [key]: next }
    registerCustomKey(key)
    triggerSave()
    notifySchemaChanged(key)
    return next
  }

  function setAttrOptions(key: string, options: AttrOption[]): void {
    const existing = schemas.value[key] ?? { name: key, type: 'select' }
    schemas.value = {
      ...schemas.value,
      [key]: {
        ...existing,
        options: [...options],
      },
    }
    triggerSave()
    notifySchemaChanged(key)
  }

  function addAttrOption(
    key: string,
    opt: { label: string, value: string, color?: string },
  ): AttrOption {
    const item = schemas.value[key] ?? { name: key, type: 'select', options: [] }
    const currentOptions = item.options ? [...item.options] : []
    const existingOpt = currentOptions.find(o => o.value === opt.value)
    if (existingOpt)
      return existingOpt

    const color = opt.color
      || PRESET_TAG_COLORS[currentOptions.length % PRESET_TAG_COLORS.length].color

    const newOption: AttrOption = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: opt.label || opt.value,
      value: opt.value,
      color,
    }

    currentOptions.push(newOption)
    schemas.value = {
      ...schemas.value,
      [key]: {
        ...item,
        options: currentOptions,
      },
    }
    triggerSave()
    notifySchemaChanged(key)
    return newOption
  }

  function removeAttrOption(key: string, optIdOrValue: string): void {
    const item = schemas.value[key]
    if (!item?.options)
      return
    const nextOptions = item.options.filter(
      o => o.id !== optIdOrValue && o.value !== optIdOrValue,
    )
    schemas.value = {
      ...schemas.value,
      [key]: {
        ...item,
        options: nextOptions,
      },
    }
    triggerSave()
    notifySchemaChanged(key)
  }

  function removeSchema(key: string): void {
    if (!schemas.value[key])
      return
    const next = { ...schemas.value }
    delete next[key]
    schemas.value = next
    triggerSave()
    notifySchemaChanged(key)
  }

  function renameSchema(oldKey: string, newKey: string, newLabel?: string): void {
    if (!schemas.value[oldKey])
      return
    const next = { ...schemas.value }
    const existing = next[oldKey]
    const updatedLabel = newLabel !== undefined ? (newLabel.trim() || undefined) : existing.label
    if (oldKey === newKey) {
      if (existing.label !== updatedLabel) {
        next[oldKey] = {
          ...existing,
          label: updatedLabel,
        }
        schemas.value = next
        triggerSave()
        notifySchemaChanged(oldKey)
      }
      return
    }
    delete next[oldKey]
    next[newKey] = {
      ...existing,
      name: newKey,
      label: updatedLabel,
    }
    schemas.value = next
    registerCustomKey(newKey)
    triggerSave()
    notifySchemaChanged(newKey)
  }

  async function resetToDefaults(): Promise<void> {
    schemas.value = JSON.parse(JSON.stringify(DEFAULT_PRESET_SCHEMAS))
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await saveAllSchemas()
    notifySchemaChanged()
  }

  function getAllSchemas(): AttrSchemaItem[] {
    return Object.values(schemas.value)
  }

  return {
    schemas,
    getSchema,
    resolveAttrType,
    setAttrType,
    setAttrOptions,
    addAttrOption,
    removeAttrOption,
    removeSchema,
    renameSchema,
    resetToDefaults,
    getAllSchemas,
  }
}
