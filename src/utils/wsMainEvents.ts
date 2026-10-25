/**
 * ws-main `transactions` 载荷的纯解析：收集发生变更的块 ID。
 * op 的块标识在 `id` 或 `blockID` 字段上（AV op 用后者）。
 */
export function collectChangedBlockIds(txs: any[]): Set<string> {
  const changedIds = new Set<string>()
  for (const tx of txs) {
    if (!tx)
      continue
    const ops = tx.doOperations
    if (!Array.isArray(ops))
      continue
    for (const op of ops) {
      if (op) {
        const id = op.id || op.blockID
        if (id)
          changedIds.add(id)
      }
    }
  }
  return changedIds
}
