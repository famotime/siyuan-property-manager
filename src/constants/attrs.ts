/**
 * 块属性的内部 vs 自定义分类规则。
 *
 * 内部属性：所有不带 `custom-` 前缀的 key，例如 id / type / name / memo。
 * 自定义属性：以 `custom-` 开头的 key。
 *
 * 在内部属性内部又细分：
 *  - READONLY_INTERNAL_KEYS 中的 key 由系统维护，写入容易破坏一致性，所以面板上展示为只读。
 *  - 其余内部 key（如 name / alias / memo）由用户填写，可在面板上直接编辑。
 *  - ALWAYS_SHOW_INTERNAL_KEYS 中列出的常用编辑项即使服务器没有返回也会以空行渲染，引导用户填写。
 */

export const READONLY_INTERNAL_KEYS = new Set<string>([
  'id',
  'type',
  'subtype',
  'updated',
  'created',
  'box',
  'path',
  'hpath',
  'parent_id',
  'root_id',
  'kramdown',
  'fcontent',
  'content',
])

export const ALWAYS_SHOW_INTERNAL_KEYS = [
  'title',
  'tags',
  'bookmark',
  'name',
  'alias',
  'memo',
] as const

/** 即使服务端未返回也强制渲染的只读 key。 */
export const ALWAYS_SHOW_READONLY_KEYS: string[] = [
  'created',
]

export const CUSTOM_KEY_PREFIX = 'custom-'

export function isCustomKey(key: string): boolean {
  return key.startsWith(CUSTOM_KEY_PREFIX)
}

export function isReadonlyKey(key: string): boolean {
  return READONLY_INTERNAL_KEYS.has(key)
}

const CUSTOM_SUFFIX_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

export function isValidCustomSuffix(suffix: string): boolean {
  return CUSTOM_SUFFIX_PATTERN.test(suffix)
}
