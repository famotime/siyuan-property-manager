<template>
  <Transition name="spm-sheet-fade">
    <div v-if="isMobileSheetOpen" class="spm-sheet-overlay">
      <div class="spm-sheet-backdrop" @click="closeMobileSheet" />
      <div
        class="spm-sheet"
        :style="{ transform: translateY > 0 ? `translateY(${translateY}px)` : undefined }"
      >
        <div
          class="spm-sheet__handle-wrapper"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div class="spm-sheet__handle" />
        </div>

        <div class="spm-sheet__header">
          <div class="spm-sheet__title">
            <svg class="spm-icon" width="16" height="16" viewBox="0 0 48 48"><use xlink:href="#iconPropertyManager" /></svg>
            <span>{{ t('mobileSheetTitle') }}</span>
          </div>
          <button
            class="spm-sheet__close-btn"
            type="button"
            :title="t('cancel')"
            @click="closeMobileSheet"
          >
            <svg class="spm-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="spm-sheet__content">
          <PropertyPanel />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Plugin } from 'siyuan'
import { inject, onBeforeUnmount, onMounted, ref } from 'vue'
import PropertyPanel from '@/components/PropertyPanel.vue'
import { useMobileSheet } from '@/composables/useMobileSheet'

const plugin = inject<Plugin>('plugin')
function t(key: string): string {
  return (plugin?.i18n?.[key] as string | undefined) ?? key
}

const { isMobileSheetOpen, closeMobileSheet } = useMobileSheet()

const startY = ref(0)
const translateY = ref(0)
const isDragging = ref(false)

function onTouchStart(e: TouchEvent) {
  if (e.touches.length > 0) {
    startY.value = e.touches[0].clientY
    isDragging.value = true
    translateY.value = 0
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value || e.touches.length === 0)
    return
  const delta = e.touches[0].clientY - startY.value
  if (delta > 0) {
    translateY.value = delta
  }
}

function onTouchEnd() {
  if (!isDragging.value)
    return
  isDragging.value = false
  if (translateY.value > 80) {
    closeMobileSheet()
  }
  translateY.value = 0
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isMobileSheetOpen.value) {
    closeMobileSheet()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>
