import type { Ref } from 'vue'
import { ref } from 'vue'
import { isCustomKey } from '@/constants/attrs'
import { suggestCustomValues } from '@/utils/autocomplete'

const DEBOUNCE_MS = 100

/**
 * 行内编辑控件的历史值联想：AttrTypeText / AttrTypeNumber 编辑态复用。
 *
 * 仅对 custom- 属性生效（内部属性不联想）；候选来自 suggestCustomValues
 * （Schema options 优先，其次 attributes 表高频历史值）。
 */
export function useValueSuggest(
  attrKey: Ref<string>,
  query: Ref<string>,
  onPick: (value: string) => void,
) {
  const items = ref<string[]>([])
  const open = ref(false)
  const highlightIndex = ref(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0

  function close() {
    open.value = false
  }

  async function refresh() {
    const key = attrKey.value
    if (!key || !isCustomKey(key)) {
      seq++
      items.value = []
      close()
      return
    }
    const mySeq = ++seq
    try {
      const list = await suggestCustomValues(key, query.value, 8)
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
      void refresh()
    }, DEBOUNCE_MS)
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

  /** 回车时若浮层激活则选中高亮项；返回是否已消费该按键。 */
  function pickHighlighted(): boolean {
    if (!open.value || items.value.length === 0)
      return false
    const val = items.value[highlightIndex.value]
    if (val === undefined)
      return false
    pick(val)
    return true
  }

  function pick(value: string) {
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
    pickHighlighted,
    pick,
  }
}
