import type { App as VueApp } from 'vue'
import type { Plugin } from 'siyuan'
import { createApp } from 'vue'
import MobileBottomSheet from '@/components/mobile/MobileBottomSheet.vue'
import { useMobileSheet } from '@/composables/useMobileSheet'

let mobileHost: HTMLElement | null = null
let mobileApp: VueApp | null = null

export function ensureMobileSheetMounted(plugin: Plugin): void {
  if (typeof document === 'undefined')
    return
  if (!mobileHost) {
    mobileHost = document.createElement('div')
    mobileHost.id = 'spm-mobile-bottom-sheet-root'
    document.body.appendChild(mobileHost)

    mobileApp = createApp(MobileBottomSheet)
    mobileApp.provide('plugin', plugin)
    mobileApp.mount(mobileHost)
  }
}

export function unmountMobileSheet(): void {
  if (mobileApp && mobileHost) {
    mobileApp.unmount()
    mobileHost.remove()
    mobileApp = null
    mobileHost = null
  }
}

export function openMobileDrawer(plugin: Plugin): void {
  ensureMobileSheetMounted(plugin)
  const { openMobileSheet } = useMobileSheet()
  openMobileSheet()
}
