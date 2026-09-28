import { ref } from 'vue'

const isMobileSheetOpen = ref(false)

export function useMobileSheet() {
  function openMobileSheet() {
    isMobileSheetOpen.value = true
  }

  function closeMobileSheet() {
    isMobileSheetOpen.value = false
  }

  function toggleMobileSheet() {
    isMobileSheetOpen.value = !isMobileSheetOpen.value
  }

  return {
    isMobileSheetOpen,
    openMobileSheet,
    closeMobileSheet,
    toggleMobileSheet,
  }
}
