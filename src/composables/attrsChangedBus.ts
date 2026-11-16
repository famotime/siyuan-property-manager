/**
 * 属性变更事件总线：把 ws-main 的事务流广播为 `spm:attrs-changed` 自定义事件。
 *
 * 面板（Dock / 文档内联 / 移动端抽屉）与 `useBlockAttrs` 的写入路径
 * 共用该事件实现跨实例同步。事件名常量：`AV_SPM_ATTRS_CHANGED_EVENT`。
 *
 * 防抖策略为 leading + trailing（SM-113）：
 * - 首个变更**立即派发**——纯尾沿防抖下，对同一块的持续写入（间隔 < 150ms）
 *   会不断重置定时器，面板刷新可被无限推迟；
 * - 合并窗口内的后续变更重置防抖，静默期结束后**补发一次最终态**，
 *   保证突发批量写入收敛后仍有一次权威刷新。
 */

import { AV_SPM_ATTRS_CHANGED_EVENT } from '@/constants/avSync'
import { collectChangedBlockIds } from '@/utils/wsMainEvents'

const DEBOUNCE_MS = 150

const timers = new Map<string, number>()

function dispatch(blockId: string): void {
  document.dispatchEvent(
    new CustomEvent(AV_SPM_ATTRS_CHANGED_EVENT, { detail: { blockId } }),
  )
}

export function dispatchAttrsChangedFromTxs(txs: any[]): void {
  for (const id of collectChangedBlockIds(txs)) {
    const existing = timers.get(id)
    if (existing) {
      // 窗口内的后续变更：重置防抖，静默期结束后补发最终态
      window.clearTimeout(existing)
      timers.set(id, window.setTimeout(() => {
        timers.delete(id)
        dispatch(id)
      }, DEBOUNCE_MS))
    }
    else {
      // 首个变更立即派发（leading），并开启合并窗口
      dispatch(id)
      timers.set(id, window.setTimeout(() => {
        timers.delete(id)
      }, DEBOUNCE_MS))
    }
  }
}

export function disposeAttrsChangedBus(): void {
  for (const timer of timers.values())
    window.clearTimeout(timer)
  timers.clear()
}
