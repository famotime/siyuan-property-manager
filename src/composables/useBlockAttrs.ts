import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { getBlockAttrs, setBlockAttrs } from '@/api'
import { AV_SPM_ATTRS_CHANGED_EVENT } from '@/constants/avSync'
import {
  ALWAYS_SHOW_INTERNAL_KEYS,
  ALWAYS_SHOW_READONLY_KEYS,
  CUSTOM_KEY_PREFIX,
  isCustomKey,
  isReadonlyKey,
  isValidCustomSuffix,
} from '@/constants/attrs'
import { removeKeyIfBlankOptimistic, rollbackOptimisticValue, rollbackRename } from '@/utils/attrLocalState'
import { formatTimestamp, parseCreatedFromId } from '@/utils/dom'

export interface AttrRowVM {
  key: string
  value: string
  readonly: boolean
  /** 服务器目前没有该 key（值为空串），仍渲染以引导用户填写。 */
  placeholder: boolean
}

export interface UseBlockAttrs {
  loading: Ref<boolean>
  error: Ref<string | null>
  internalAttrs: ComputedRef<AttrRowVM[]>
  customAttrs: ComputedRef<AttrRowVM[]>
  blockType: ComputedRef<string>
  notebookId: ComputedRef<string>
  saveAttr: (key: string, value: string) => Promise<void>
  deleteAttr: (key: string) => Promise<void>
  addCustom: (suffix: string, value: string) => Promise<void>
  renameCustom: (oldKey: string, newSuffix: string) => Promise<void>
  /** 强制重新拉取当前块属性。 */
  reload: () => Promise<void>
}

export function useBlockAttrs(blockIdRef: Readonly<Ref<BlockId | null>>): UseBlockAttrs {
  const raw = ref<Record<string, string>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 单调递增的加载标记。每次 blockId 变化或显式 reload 都会递增。
  // 拉取返回后比对当前值，若已落后则丢弃，避免老响应覆盖新数据。
  let loadToken = 0
  // 同一块上正在飞行的写入操作，按 promise 链串行，避免乱序覆盖。
  // 链按目标块而非按 key 建（SM-107）：renameCustom 会同时写两个键，
  // 按 key 串行无法覆盖跨键交错。
  const inflight = new Map<string, Promise<void>>()

  async function reload(): Promise<void> {
    const id = blockIdRef.value
    if (!id) {
      raw.value = {}
      loading.value = false
      error.value = null
      return
    }
    const token = ++loadToken
    loading.value = true
    error.value = null
    try {
      const attrs = (await getBlockAttrs(id)) ?? {}
      if (token !== loadToken)
        return
      // created 未返回时从块 ID 解析
      if (!attrs.created && id)
        attrs.created = parseCreatedFromId(id)
      // 时间戳格式化
      if (attrs.created)
        attrs.created = formatTimestamp(attrs.created)
      if (attrs.updated)
        attrs.updated = formatTimestamp(attrs.updated)
      raw.value = { ...attrs }
    }
    catch (err: any) {
      if (token !== loadToken)
        return
      error.value = err?.message ?? String(err)
    }
    finally {
      if (token === loadToken)
        loading.value = false
    }
  }

  watch(blockIdRef, () => {
    inflight.clear()
    void reload()
  }, { immediate: true })

  function chainWrite(blockId: string, fn: () => Promise<void>): Promise<void> {
    const prev = inflight.get(blockId) ?? Promise.resolve()
    const next = prev.catch(() => undefined).then(fn)
    inflight.set(blockId, next)
    // 用 then(settle, settle) 而非 finally：finally 派生的 promise 会以
    // unhandled rejection 落地（调用方拿到的是 next 本身，另有一个消费者）。
    const settle = () => {
      if (inflight.get(blockId) === next)
        inflight.delete(blockId)
    }
    next.then(settle, settle)
    return next
  }

  async function writeAttr(key: string, value: string): Promise<void> {
    const id = blockIdRef.value
    if (!id) {
      throw new Error('No active block')
    }
    const targetId = id
    // 乐观更新：先把新值写到本地缓存，UI 立即反映。
    const before = raw.value[key]
    raw.value = { ...raw.value, [key]: value }

    await chainWrite(targetId, async () => {
      try {
        await setBlockAttrs(targetId, { [key]: value })
        // 若期间块已切换，不再合并到当前 raw（属于旧块的状态）。
        if (blockIdRef.value !== targetId)
          return
        // 通知其他 useBlockAttrs 实例同步刷新（如 Dock 面板 ↔ 文档内联属性面板）。
        document.dispatchEvent(
          new CustomEvent(AV_SPM_ATTRS_CHANGED_EVENT, { detail: { blockId: targetId } }),
        )
        // 值为空串时思源会删除属性，本地状态对齐：仅当本地仍是本次乐观值
        // （空串）时才移除 key（SM-107），避免吞掉更晚写入的新值。
        const next = removeKeyIfBlankOptimistic(raw.value, key)
        if (next)
          raw.value = next
      }
      catch (err: any) {
        // 条件回滚乐观更新：仅当本地仍是本次乐观值时回滚（SM-107），
        // 避免早失败写的回滚覆盖更晚写入的乐观值。
        if (blockIdRef.value === targetId) {
          const next = rollbackOptimisticValue(raw.value, key, value, before)
          if (next)
            raw.value = next
        }
        throw err
      }
    })
  }

  async function saveAttr(key: string, value: string): Promise<void> {
    if (raw.value[key] === value)
      return
    await writeAttr(key, value)
  }

  async function deleteAttr(key: string): Promise<void> {
    // 删除即将值设为空串，思源会自动清理这一 key。
    await writeAttr(key, '')
  }

  async function addCustom(suffix: string, value: string): Promise<void> {
    if (!isValidCustomSuffix(suffix))
      throw new Error('Invalid custom attribute name')
    const key = CUSTOM_KEY_PREFIX + suffix
    if (raw.value[key] !== undefined)
      throw new Error(`Attribute "${key}" already exists`)
    await writeAttr(key, value)
  }

  async function renameCustom(oldKey: string, newSuffix: string): Promise<void> {
    if (!isValidCustomSuffix(newSuffix))
      throw new Error('Invalid custom attribute name')
    const newKey = CUSTOM_KEY_PREFIX + newSuffix
    if (newKey === oldKey)
      return
    if (raw.value[newKey] !== undefined)
      throw new Error(`Attribute "${newKey}" already exists`)
    const val = raw.value[oldKey] ?? ''
    const id = blockIdRef.value
    if (!id)
      throw new Error('No active block')
    const targetId = id

    // 乐观更新
    const next = { ...raw.value }
    delete next[oldKey]
    next[newKey] = val
    raw.value = next

    await chainWrite(targetId, async () => {
      try {
        await setBlockAttrs(targetId, {
          [newKey]: val,
          [oldKey]: '',
        })
        if (blockIdRef.value !== targetId)
          return
        document.dispatchEvent(
          new CustomEvent(AV_SPM_ATTRS_CHANGED_EVENT, { detail: { blockId: targetId } }),
        )
      }
      catch (err: any) {
        // 条件回滚（SM-107）：仅当新键仍持有本次乐观值且旧键未被重建时还原
        if (blockIdRef.value === targetId) {
          const rollback = rollbackRename(raw.value, oldKey, newKey, val)
          if (rollback)
            raw.value = rollback
        }
        throw err
      }
    })
  }

  const internalAttrs = computed<AttrRowVM[]>(() => {
    const rows: AttrRowVM[] = []
    const seen = new Set<string>()

    // 1. 服务器返回的所有非 custom- 属性
    for (const key of Object.keys(raw.value)) {
      if (isCustomKey(key))
        continue
      seen.add(key)
      rows.push({
        key,
        value: raw.value[key] ?? '',
        readonly: isReadonlyKey(key),
        placeholder: false,
      })
    }

    // 2. 始终展示的可编辑常用项，未返回时以空行渲染
    for (const key of ALWAYS_SHOW_INTERNAL_KEYS) {
      if (seen.has(key))
        continue
      rows.push({
        key,
        value: '',
        readonly: false,
        placeholder: true,
      })
    }

    // 3. 始终展示的只读项，未返回时以空行渲染
    for (const key of ALWAYS_SHOW_READONLY_KEYS) {
      if (seen.has(key))
        continue
      rows.push({
        key,
        value: '',
        readonly: true,
        placeholder: true,
      })
    }

    // 排序：只读项靠前（id、type 等元信息）→ 可编辑项按 ALWAYS_SHOW_INTERNAL_KEYS 顺序 → 其余字母序
    const editableOrder = new Map<string, number>(
      ALWAYS_SHOW_INTERNAL_KEYS.map((k, i) => [k, i]),
    )
    rows.sort((a, b) => {
      if (a.readonly !== b.readonly)
        return a.readonly ? -1 : 1
      const oa = editableOrder.get(a.key) ?? Infinity
      const ob = editableOrder.get(b.key) ?? Infinity
      if (oa !== ob)
        return oa - ob
      return a.key.localeCompare(b.key)
    })

    return rows
  })

  const customAttrs = computed<AttrRowVM[]>(() => {
    return Object.keys(raw.value)
      .filter(isCustomKey)
      .sort((a, b) => a.localeCompare(b))
      .map<AttrRowVM>(key => ({
        key,
        value: raw.value[key] ?? '',
        readonly: false,
        placeholder: false,
      }))
  })

  const blockType = computed(() => raw.value.type ?? '')
  const notebookId = computed(() => raw.value.box ?? '')

  return {
    loading,
    error,
    internalAttrs,
    customAttrs,
    blockType,
    notebookId,
    saveAttr,
    deleteAttr,
    addCustom,
    renameCustom,
    reload,
  }
}
