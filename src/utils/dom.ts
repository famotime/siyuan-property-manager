export interface ResolvedBlock {
  id: BlockId
  kind: 'doc' | 'block'
}

/**
 * 从一次 click-editorcontent 事件中解析当前块。
 *
 * 规则：
 *  1. 优先取最近的 `[data-node-id]` 容器（段落/标题/列表项等）。
 *  2. 如果点击发生在文档标题区域 `.protyle-title`，把当前块视作文档块本身。
 *  3. 都不匹配时退回到 protyle.block.rootID（保持 dock 始终有内容显示）。
 */
export function findBlockIdFromEvent(
  event: MouseEvent | undefined,
  rootId: BlockId | undefined,
): ResolvedBlock | null {
  const target = (event?.target as HTMLElement | null) ?? null

  if (target) {
    const blockEl = target.closest<HTMLElement>('[data-node-id]')
    if (blockEl) {
      const id = blockEl.getAttribute('data-node-id') ?? ''
      if (id) {
        return { id, kind: id === rootId ? 'doc' : 'block' }
      }
    }

    if (target.closest('.protyle-title') && rootId) {
      return { id: rootId, kind: 'doc' }
    }
  }

  return rootId ? { id: rootId, kind: 'doc' } : null
}

/**
 * 决定编辑态使用 input 还是 textarea。
 *
 * - 含换行：肯定用 textarea。
 * - 单行但长度超过阈值：也用 textarea，避免水平滚动。
 */
export function isMultiline(value: string): boolean {
  if (!value)
    return false
  return value.includes('\n') || value.length > 60
}

/**
 * 给定 blockId（思源 ID 形如 20240115093000-abc1234），返回方便阅读的短形式。
 */
export function shortBlockId(id: string | null | undefined): string {
  if (!id)
    return ''
  const dashAt = id.indexOf('-')
  if (dashAt === -1)
    return id
  return id.slice(dashAt + 1)
}
