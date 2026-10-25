import type { Ref } from 'vue'
import { nextTick, ref, watch } from 'vue'

export interface UseInlineEditOptions {
  /** 当前值（`props.modelValue` 的 getter）。 */
  modelValue: () => string
  /** 只读守卫，进入编辑前检查。 */
  isReadonly?: () => boolean
  inputEl: Ref<HTMLInputElement | HTMLTextAreaElement | null>
  /** 编辑态切换通知（如 AttrRow 的行高亮）。 */
  onEditChange?: (editing: boolean) => void
  /** 退出编辑（提交或取消）前的清理，如关闭联想浮层。 */
  beforeExit?: () => void
  /** 提交前变换（如 Number 的 trim）。 */
  transformCommit?: (draft: string) => string
  onCommit: (value: string) => void
  onCancel?: () => void
}

/**
 * 行内编辑生命周期：进入编辑（聚焦全选 + 200ms 失焦豁免）、
 * 提交（blur/enter）、取消（esc 还原草稿）。
 *
 * AttrTypeText / AttrTypeNumber 的逐行重复收敛于此。
 */
export function useInlineEdit(options: UseInlineEditOptions) {
  const editing = ref(false)
  const draft = ref(options.modelValue())
  let justEntered = false

  watch(options.modelValue, (next) => {
    draft.value = next
  })

  function enterEdit() {
    if (options.isReadonly?.() || editing.value)
      return
    draft.value = options.modelValue()
    editing.value = true
    justEntered = true
    options.onEditChange?.(true)
    setTimeout(() => {
      justEntered = false
    }, 200)
    nextTick(() => {
      options.inputEl.value?.focus()
      options.inputEl.value?.select()
    })
  }

  function commit() {
    if (!editing.value)
      return
    editing.value = false
    options.onEditChange?.(false)
    options.beforeExit?.()
    const next = options.transformCommit ? options.transformCommit(draft.value) : draft.value
    options.onCommit(next)
  }

  function cancel() {
    editing.value = false
    options.onEditChange?.(false)
    options.beforeExit?.()
    draft.value = options.modelValue()
    options.onCancel?.()
  }

  /** blur 提交；进入编辑后 200ms 内的 blur 豁免（避免聚焦动作被外部抢焦点吞掉编辑）。 */
  function consumeBlur() {
    if (justEntered)
      return
    commit()
  }

  return { editing, draft, enterEdit, commit, cancel, consumeBlur }
}
