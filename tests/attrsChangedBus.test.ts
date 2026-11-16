import test from 'node:test'
import assert from 'node:assert/strict'

// SM-113：块变更广播为 leading + trailing 防抖——首个变更立即派发，
// 窗口内后续变更合并、静默期结束后补发一次最终态。
//
// 模块在调用点才使用 window / document：先装桩再动态导入
// （document 只用到 dispatchEvent；Node 22 自带 CustomEvent 全局）。
const dispatched: string[] = []
;(globalThis as any).window = {
  setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
  clearTimeout: (id: any) => clearTimeout(id),
}
;(globalThis as any).document = {
  dispatchEvent: (event: any) => {
    dispatched.push(event?.detail?.blockId)
    return true
  },
}

const { dispatchAttrsChangedFromTxs, disposeAttrsChangedBus } = await import('../src/composables/attrsChangedBus.ts')

function txFor(id: string): any[] {
  return [{ doOperations: [{ id }] }]
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function countFor(id: string): number {
  return dispatched.filter(candidate => candidate === id).length
}

test('first change dispatches immediately on the leading edge', async () => {
  dispatchAttrsChangedFromTxs(txFor('b1'))
  assert.deepEqual(dispatched, ['b1'])
  // 合并窗口静默过期（无后续变更）后不再追加派发
  await sleep(200)
  assert.equal(countFor('b1'), 1)
})

test('changes within the window coalesce into one trailing dispatch', async () => {
  dispatchAttrsChangedFromTxs(txFor('b2')) // leading 立即派发
  await sleep(50)
  dispatchAttrsChangedFromTxs(txFor('b2')) // 窗口内再变 → 重置防抖
  await sleep(60)
  assert.equal(countFor('b2'), 1, '窗口内只有 leading 派发')
  await sleep(180)
  assert.equal(countFor('b2'), 2, '静默期结束后补发最终态')
})

test('dispose cancels pending trailing dispatches', async () => {
  dispatchAttrsChangedFromTxs(txFor('b3')) // leading
  dispatchAttrsChangedFromTxs(txFor('b3')) // 排定 trailing
  disposeAttrsChangedBus()
  await sleep(200)
  assert.equal(countFor('b3'), 1, 'trailing 补发被取消')
})
