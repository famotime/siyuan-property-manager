import type { Ref } from 'vue'
import { isCustomKey } from '@/constants/attrs'
import { useSuggestDropdown } from '@/composables/useSuggestDropdown'
import { suggestCustomValues } from '@/utils/autocomplete'

/**
 * 行内编辑控件的历史值联想：AttrTypeText / AttrTypeNumber 编辑态复用。
 *
 * 仅对 custom- 属性生效（内部属性不联想）；候选来自 suggestCustomValues
 * （Schema options 优先，其次 attributes 表高频历史值）。
 * 状态机本体在 `useSuggestDropdown`。
 */
export function useValueSuggest(
  attrKey: Ref<string>,
  query: Ref<string>,
  onPick: (value: string) => void,
) {
  return useSuggestDropdown<string>(
    query,
    (q) => {
      const key = attrKey.value
      if (!key || !isCustomKey(key))
        return []
      return suggestCustomValues(key, q, 8)
    },
    onPick,
  )
}
