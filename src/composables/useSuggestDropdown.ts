import type { Ref } from 'vue'
import { ref } from 'vue'

const DEFAULT_DEBOUNCE_MS = 100

/**
 * 输入联想浮层的通用状态机：防抖拉取（乱序守卫）、高亮循环导航、回车/Tab 选中。
 *
 * `useValueSuggest`（历史值联想）与 AddCustomRow 的键名/属性值两处平行实现
 * 收敛于此；fetcher 可同步或异步，条目类型由调用方决定。
 */
export function useSuggestDropdown<T>(
  query: Ref<string>,
  fetcher: (query: string) => Promise<T[]> | T[],
  onPick: (item: T) => void,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const open = ref(false)
  const highlightIndex = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  function close() {
    // 取消尚未触发的防抖、作废在途 fetch，防止关闭后浮层被迟到的 refresh 重新打开。
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    seq++
    open.value = false
  }

  async function refresh() {
    const mySeq = ++seq
    try {
      const list = await fetcher(query.value)
      if (mySeq !== seq)
        return
      items.value = list
      highlightIndex.value = 0
      open.value = list.length > 0
    }
    catch {
      if (mySeq === seq)
        close()
    }
  }

  function schedule() {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void refresh()
    }, debounceMs)
  }

  function navDown() {
    if (!open.value || items.value.length === 0)
      return
    highlightIndex.value = (highlightIndex.value + 1) % items.value.length
  }

  function navUp() {
    if (!open.value || items.value.length === 0)
      return
    highlightIndex.value = (highlightIndex.value - 1 + items.value.length) % items.value.length
  }

  function getHighlighted(): T | undefined {
    return items.value[highlightIndex.value]
  }

  /** 回车时若浮层激活则选中高亮项；返回是否已消费该按键。 */
  function pickHighlighted(): boolean {
    const val = getHighlighted()
    if (!open.value || val === undefined)
      return false
    pick(val)
    return true
  }

  function pick(value: T) {
    onPick(value)
    close()
  }

  return {
    items,
    open,
    highlightIndex,
    refresh,
    schedule,
    close,
    navDown,
    navUp,
    getHighlighted,
    pickHighlighted,
    pick,
  }
}
