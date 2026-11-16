/**
 * 块属性本地缓存的「最新写」守卫（SM-107，纯函数，有单元测试）。
 *
 * `useBlockAttrs` 采用乐观更新：写请求发出前先改本地 `raw`。当同一 key/block
 * 上有多次交错写入时，早发起的写请求在失败回滚或成功收尾时，可能覆盖
 * 更晚写入的乐观值。此处的守卫统一规则：**只有本地值仍等于本次写入的
 * 乐观值时，才允许变动本地状态**；否则说明已有更新的写入，静默跳过。
 *
 * 返回 `null` 表示守卫拦截（不产生新状态），返回新对象表示应用变更
 * （调用方以返回值替换整个 raw，保持不可变更新风格）。
 */

/**
 * 乐观写失败的条件回滚：仅当本地值仍等于本次乐观值时回滚到写前值。
 * `previousValue === undefined` 表示写入前该 key 不存在（回滚即删除）。
 */
export function rollbackOptimisticValue(
  raw: Record<string, string>,
  key: string,
  optimisticValue: string,
  previousValue: string | undefined,
): Record<string, string> | null {
  if (raw[key] !== optimisticValue)
    return null
  const next = { ...raw }
  if (previousValue === undefined)
    delete next[key]
  else
    next[key] = previousValue
  return next
}

/**
 * 空串写成功后的本地删除守卫：思源语义中写入空串即删除属性。
 * 仅当本地仍是本次乐观写入的空串时才移除 key，避免吞掉更晚写入的新值。
 */
export function removeKeyIfBlankOptimistic(
  raw: Record<string, string>,
  key: string,
): Record<string, string> | null {
  if (raw[key] !== '')
    return null
  const next = { ...raw }
  delete next[key]
  return next
}

/**
 * 重命名失败的条件回滚：仅当新键仍持有本次乐观值、且旧键未被其他写入
 * 重新创建时，移除新键并还原旧键。
 */
export function rollbackRename(
  raw: Record<string, string>,
  oldKey: string,
  newKey: string,
  optimisticValue: string,
): Record<string, string> | null {
  if (raw[newKey] !== optimisticValue)
    return null
  if (raw[oldKey] !== undefined)
    return null
  const next = { ...raw }
  delete next[newKey]
  next[oldKey] = optimisticValue
  return next
}
