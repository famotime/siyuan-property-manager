import { CUSTOM_KEY_PREFIX } from '@/constants/attrs'

type SqlRunner = (stmt: string) => Promise<any[]>
let customSqlRunner: SqlRunner | null = null

export function setSqlRunner(runner: SqlRunner | null) {
  customSqlRunner = runner
}

async function runSql(stmt: string): Promise<any[]> {
  if (customSqlRunner)
    return customSqlRunner(stmt)
  try {
    const api = await import('@/api')
    return api.sql(stmt)
  }
  catch {
    return []
  }
}

// 属性名内存常驻缓存
let customKeysCache: Set<string> = new Set()
let isKeyCacheInitialized = false

// 属性值按 key 缓存（5 分钟过期）
interface ValueCacheEntry {
  timestamp: number
  values: string[]
}
const valueCache = new Map<string, ValueCacheEntry>()
const VALUE_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * 重置/注入缓存（供单元测试使用）
 */
export function _setAutocompleteCacheForTest(keys: string[], valuesMap?: Record<string, string[]>) {
  customKeysCache = new Set(keys)
  isKeyCacheInitialized = true
  valueCache.clear()
  if (valuesMap) {
    for (const [k, v] of Object.entries(valuesMap)) {
      valueCache.set(k, { timestamp: Date.now(), values: v })
    }
  }
}

/**
 * 初始化属性名缓存
 */
export async function initCustomKeysCache(extraKeys: string[] = []): Promise<void> {
  const merged = new Set<string>()
  for (const k of extraKeys) {
    if (k.startsWith(CUSTOM_KEY_PREFIX))
      merged.add(k.slice(CUSTOM_KEY_PREFIX.length))
    else
      merged.add(k)
  }

  try {
    const rows = await runSql(`SELECT DISTINCT name FROM attributes WHERE name LIKE '${CUSTOM_KEY_PREFIX}%'`)
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && typeof row.name === 'string') {
          const suffix = row.name.slice(CUSTOM_KEY_PREFIX.length)
          if (suffix)
            merged.add(suffix)
        }
      }
    }
  }
  catch {
    // 静默降级
  }

  customKeysCache = merged
  isKeyCacheInitialized = true
}

/**
 * 动态记录新使用的属性名到内存缓存
 */
export function registerCustomKey(suffixOrFull: string): void {
  const suffix = suffixOrFull.startsWith(CUSTOM_KEY_PREFIX)
    ? suffixOrFull.slice(CUSTOM_KEY_PREFIX.length)
    : suffixOrFull
  if (suffix)
    customKeysCache.add(suffix)
}

/**
 * 拼音首字母音序边界与提取算法
 */
const PINYIN_BOUNDARIES = ['啊', '芭', '擦', '搭', '蛾', '发', '噶', '哈', '击', '喀', '垃', '妈', '拿', '哦', '啪', '期', '然', '撒', '塌', '挖', '昔', '压', '匝']
const PINYIN_LETTERS = 'abcdefghjklmnopqrstwxyz'.split('')

function getCharPinyinInitial(char: string): string {
  if (/^[a-zA-Z0-9]$/.test(char))
    return char.toLowerCase()
  try {
    for (let i = PINYIN_BOUNDARIES.length - 1; i >= 0; i--) {
      if (char.localeCompare(PINYIN_BOUNDARIES[i], 'zh-Hans-CN') >= 0) {
        return PINYIN_LETTERS[i]
      }
    }
  }
  catch {
    // 忽略异常
  }
  return ''
}

function getWordPinyinInitials(word: string): string {
  let res = ''
  for (const c of word) {
    const p = getCharPinyinInitial(c)
    if (p)
      res += p
  }
  return res
}

/**
 * 模糊及拼音匹配
 */
export function matchQuery(target: string, query: string): { matched: boolean, score: number } {
  const t = target.toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q)
    return { matched: true, score: 0 }

  // 1. 完全一致
  if (t === q)
    return { matched: true, score: 100 }

  // 2. 前缀匹配
  if (t.startsWith(q))
    return { matched: true, score: 80 - (t.length - q.length) }

  // 3. 子串匹配
  if (t.includes(q))
    return { matched: true, score: 60 - t.indexOf(q) }

  // 4. 拼音首字母匹配
  const py = getWordPinyinInitials(target)
  if (py.includes(q))
    return { matched: true, score: 40 - py.indexOf(q) }

  return { matched: false, score: -1 }
}

/**
 * 检索匹配的属性名候选列表
 */
export function suggestCustomKeys(query: string, limit = 10): string[] {
  const q = query.trim()
  const candidates: Array<{ key: string, score: number }> = []

  for (const key of customKeysCache) {
    const { matched, score } = matchQuery(key, q)
    if (matched) {
      candidates.push({ key, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
  return candidates.slice(0, limit).map(c => c.key)
}

/**
 * 检索匹配的属性值候选列表（优先使用短期缓存，缺失时异步按需拉取）
 */
export async function suggestCustomValues(key: string, query: string, limit = 10): Promise<string[]> {
  const fullKey = key.startsWith(CUSTOM_KEY_PREFIX) ? key : CUSTOM_KEY_PREFIX + key
  const now = Date.now()
  let entry = valueCache.get(fullKey)

  if (!entry || now - entry.timestamp > VALUE_CACHE_TTL_MS) {
    try {
      const rows = await runSql(
        `SELECT value, COUNT(1) AS cnt FROM attributes WHERE name = '${fullKey}' AND value != '' GROUP BY value ORDER BY cnt DESC LIMIT 50`,
      )
      const values: string[] = []
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (r && typeof r.value === 'string' && r.value.trim()) {
            values.push(r.value.trim())
          }
        }
      }
      entry = { timestamp: now, values }
      valueCache.set(fullKey, entry)
    }
    catch {
      entry = { timestamp: now, values: [] }
    }
  }

  const q = query.trim()
  const candidates: Array<{ val: string, score: number }> = []
  for (const v of entry.values) {
    const { matched, score } = matchQuery(v, q)
    if (matched) {
      candidates.push({ val: v, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, limit).map(c => c.val)
}
