import type { Ref } from 'vue'
import { nextTick, onBeforeUnmount, ref } from 'vue'

export interface UseDropdownOptions {
  containerEl: Ref<HTMLElement | null>
  /** 打开后 nextTick 钩子（聚焦搜索框、执行首搜等），先于外部点击监听挂载。 */
  onOpen?: () => void
}

/**
 * 下拉浮层开关 + 点击外部关闭。
 *
 * AttrTypeSelect / AttrTypeMultiSelect / AttrTypeDate / AttrTypeCheckbox /
 * AttrTypeMenu / AttrTypeBlockRef 六处副本收敛于此。
 * 外部点击监听延迟到 nextTick 挂载，避免触发打开的那次 click 事件冒泡到
 * document 时立刻把浮层关掉。
 */
export function useDropdown(options: UseDropdownOptions) {
  const open = ref(false)

  function onDocClick(e: MouseEvent) {
    if (options.containerEl.value && !options.containerEl.value.contains(e.target as Node))
      open.value = false
  }

  function openDropdown() {
    open.value = true
    nextTick(() => {
      options.onOpen?.()
      document.addEventListener('click', onDocClick)
    })
  }

  function closeDropdown() {
    open.value = false
    document.removeEventListener('click', onDocClick)
  }

  function toggleDropdown() {
    if (open.value)
      closeDropdown()
    else
      openDropdown()
  }

  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick)
  })

  return { open, openDropdown, closeDropdown, toggleDropdown }
}
