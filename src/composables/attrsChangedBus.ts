/**
 * 属性变更事件总线：把 ws-main 的事务流按块 ID 防抖 150ms 后
 * 广播为 `spm:attrs-changed` 自定义事件。
 *
 * 面板（Dock / 文档内联 / 移动端抽屉）与 `useBlockAttrs` 的写入路径
 * 共用该事件实现跨实例同步。事件名常量：`AV_SPM_ATTRS_CHANGED_EVENT`。
 */

import { AV_SPM_ATTRS_CHANGED_EVENT } from '@/constants/avSync'
import { collectChangedBlockIds } from '@/utils/wsMainEvents'

const DEBOUNCE_MS = 150

const timers = new Map<string, number>()

export function dispatchAttrsChangedFromTxs(txs: any[]): void {
  for (const id of collectChangedBlockIds(txs)) {
    const existing = timers.get(id)
    if (existing)
      window.clearTimeout(existing)
    const timer = window.setTimeout(() => {
      timers.delete(id)
      document.dispatchEvent(
        new CustomEvent(AV_SPM_ATTRS_CHANGED_EVENT, { detail: { blockId: id } }),
      )
    }, DEBOUNCE_MS)
    timers.set(id, timer)
  }
}

export function disposeAttrsChangedBus(): void {
  for (const timer of timers.values())
    window.clearTimeout(timer)
  timers.clear()
}
