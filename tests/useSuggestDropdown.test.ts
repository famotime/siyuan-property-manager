import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useSuggestDropdown } from '../src/composables/useSuggestDropdown.ts'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test('refresh populates items and opens dropdown for non-empty list', async () => {
  const query = ref('a')
  const picked: string[] = []
  const s = useSuggestDropdown<string>(query, q => [`x-${q}`], v => picked.push(v))
  await s.refresh()
  assert.deepEqual(s.items.value, ['x-a'])
  assert.equal(s.open.value, true)
  assert.equal(s.highlightIndex.value, 0)
})

test('refresh closes dropdown for empty list', async () => {
  const s = useSuggestDropdown<string>(ref('a'), () => [], () => {})
  await s.refresh()
  assert.equal(s.open.value, false)
  assert.deepEqual(s.items.value, [])
})

test('stale async fetch result is discarded by seq guard', async () => {
  const query = ref('a')
  let call = 0
  const s = useSuggestDropdown<string>(query, async (q) => {
    call++
    if (call === 1) {
      await sleep(60) // 第一次更慢
      return ['stale']
    }
    return [`fresh-${q}`]
  }, () => {})
  const first = s.refresh()
  query.value = 'b'
  const second = s.refresh()
  await Promise.all([first, second])
  assert.deepEqual(s.items.value, ['fresh-b'])
})

test('fetch error closes dropdown without throwing', async () => {
  const s = useSuggestDropdown<string>(ref('a'), async () => {
    throw new Error('boom')
  }, () => {})
  await s.refresh()
  assert.equal(s.open.value, false)
})

test('schedule debounces rapid input into one fetch', async () => {
  let fetches = 0
  const s = useSuggestDropdown<string>(ref(''), async () => {
    fetches++
    return ['x']
  }, () => {}, 20)
  s.schedule()
  s.schedule()
  s.schedule()
  await sleep(60)
  assert.equal(fetches, 1)
  assert.equal(s.open.value, true)
})

test('navDown/navUp cycle highlight and no-op when closed', async () => {
  const s = useSuggestDropdown<string>(ref(''), () => ['a', 'b', 'c'], () => {})
  s.navDown() // 未打开
  assert.equal(s.highlightIndex.value, 0)
  await s.refresh()
  s.navDown()
  s.navDown()
  assert.equal(s.highlightIndex.value, 2)
  s.navDown()
  assert.equal(s.highlightIndex.value, 0)
  s.navUp()
  assert.equal(s.highlightIndex.value, 2)
})

test('pickHighlighted picks current item and closes; false when closed', async () => {
  const picked: string[] = []
  const s = useSuggestDropdown<string>(ref(''), () => ['a', 'b'], v => picked.push(v))
  assert.equal(s.pickHighlighted(), false)
  await s.refresh()
  s.navDown()
  assert.equal(s.pickHighlighted(), true)
  assert.deepEqual(picked, ['b'])
  assert.equal(s.open.value, false)
})

test('pick invokes onPick with arbitrary item type', async () => {
  const picked: Array<{ value: string, label?: string }> = []
  const s = useSuggestDropdown<{ value: string, label?: string }>(ref(''), () => [{ value: 'v', label: 'L' }], (item) => { picked.push(item) })
  await s.refresh()
  const first = s.items.value[0]
  assert.ok(first)
  s.pick(first)
  assert.deepEqual(picked, [{ value: 'v', label: 'L' }])
  assert.equal(s.open.value, false)
})
