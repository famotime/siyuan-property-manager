import type { Plugin } from 'siyuan'
import type { AttrOption, AttrSchemaItem, AttrType, TypesSchemaStorage } from '@/types/schema'
import { ref } from 'vue'
import { DEFAULT_PRESET_SCHEMAS, PRESET_TAG_COLORS, TYPES_SCHEMA_STORAGE_NAME } from '@/constants/schema'
import { registerCustomKey, setAutocompleteCheckedLabels, setAutocompleteSchemaResolver } from '@/utils/autocomplete'
import { inferAttrType } from '@/utils/typeInference'

const DEBOUNCE_MS = 300

function serializeSchemas(val: Record<string, AttrSchemaItem>): string {
  const sorted: Record<string, any> = {}
  for (const k of Object.keys(val).sort()) {
    sorted[k] = val[k]
  }
  return JSON.stringify(sorted)
}

const schemas = ref<Record<string, AttrSchemaItem>>({})
let isLoaded = false
let currentPlugin: Plugin | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedSchemasJson = ''

export async function initSchemas(plugin: Plugin): Promise<void> {
  currentPlugin = plugin
  try {
    const data = (await plugin.loadData(TYPES_SCHEMA_STORAGE_NAME)) as TypesSchemaStorage | undefined
    if (data && typeof data === 'object' && data.schemas && typeof data.schemas === 'object' && Object.keys(data.schemas).length > 0) {
      // 合并默认预设属性与用户自定义配置（用户配置优先）
      schemas.value = {
        ...DEFAULT_PRESET_SCHEMAS,
        ...data.schemas,
      }
      // 基线与 saveAllSchemas 的比较对象（内存中的合并态）保持一致，
      // 否则首次编辑总会触发一次冗余写入。
      lastSavedSchemasJson = serializeSchemas(schemas.value)
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
  // 注入复选框默认候选的本地化标签（i18n 的 checkedTrue / checkedFalse）
  const i18n = currentPlugin.i18n as Record<string, string> | undefined
  setAutocompleteCheckedLabels(i18n?.checkedTrue || 'true', i18n?.checkedFalse || 'false')
  for (const k of Object.keys(schemas.value)) {
    registerCustomKey(k)
  }
}

export async function reloadSchemas(): Promise<void> {
  if (!currentPlugin)
    return
  try {
    const data = (await currentPlugin.loadData(TYPES_SCHEMA_STORAGE_NAME)) as TypesSchemaStorage | undefined
    if (data && typeof data === 'object' && data.schemas && typeof data.schemas === 'object') {
      // 与 initSchemas 相同的合并规则（用户配置优先），避免 reload 后预设丢失
      const nextJson = serializeSchemas({ ...DEFAULT_PRESET_SCHEMAS, ...data.schemas })
      if (nextJson !== lastSavedSchemasJson) {
        schemas.value = { ...DEFAULT_PRESET_SCHEMAS, ...data.schemas }
        lastSavedSchemasJson = nextJson
        for (const k of Object.keys(schemas.value)) {
          registerCustomKey(k)
        }
      }
    }
  }
  catch {
    // 忽略重新加载错误
  }
}

async function saveAllSchemas(): Promise<void> {
  if (!currentPlugin || !isLoaded)
    return
  const nextJson = serializeSchemas(schemas.value)
  if (nextJson === lastSavedSchemasJson)
    return
  try {
    const payload: TypesSchemaStorage = {
      version: 1,
      schemas: schemas.value,
    }
    lastSavedSchemasJson = nextJson
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

// 说明：曾派发的 document 事件 `spm:schema-changed` 已移除——所有面板共享同一
// 模块级响应式 schemas 单例，UI 刷新由 Vue 响应式直接覆盖，事件并无消费者。

// 供单元测试重置状态使用
export function _resetSchemasForTest(initial: Record<string, AttrSchemaItem> = {}): void {
  schemas.value = { ...initial }
  lastSavedSchemasJson = serializeSchemas(schemas.value)
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
  }

  /** 更新展示格式（dateFormat / numberFormat），只影响渲染，不影响存储值。 */
  function setAttrFormats(
    key: string,
    formats: { dateFormat?: string, numberFormat?: AttrSchemaItem['numberFormat'] },
  ): void {
    const existing = schemas.value[key]
    if (!existing)
      return
    const next: AttrSchemaItem = { ...existing }
    if (formats.dateFormat !== undefined)
      next.dateFormat = formats.dateFormat
    if (formats.numberFormat !== undefined)
      next.numberFormat = formats.numberFormat
    schemas.value = { ...schemas.value, [key]: next }
    triggerSave()
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
  }

  function removeSchema(key: string): void {
    if (!schemas.value[key])
      return
    const next = { ...schemas.value }
    delete next[key]
    schemas.value = next
    triggerSave()
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
  }

  async function resetToDefaults(): Promise<void> {
    schemas.value = JSON.parse(JSON.stringify(DEFAULT_PRESET_SCHEMAS))
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await saveAllSchemas()
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
    setAttrFormats,
    addAttrOption,
    removeAttrOption,
    removeSchema,
    renameSchema,
    resetToDefaults,
    getAllSchemas,
  }
}
