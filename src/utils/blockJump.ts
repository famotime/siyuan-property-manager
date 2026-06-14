function escapeSelectorValue(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/"/g, '\\"')
}

export function buildDocWysiwygSelector(rootId: string): string {
  return `.protyle[data-doc-id="${escapeSelectorValue(rootId)}"] .protyle-wysiwyg`
}

export function buildDocWysiwygSelectors(rootId: string): string[] {
  const id = escapeSelectorValue(rootId)
  return [
    `.protyle[data-doc-id="${id}"] .protyle-wysiwyg`,
    `.protyle:has(.protyle-title[data-node-id="${id}"]) .protyle-wysiwyg`,
  ]
}

export function buildBlockSelector(rootId: string, blockId: string): string {
  return `${buildDocWysiwygSelector(rootId)} [data-node-id="${escapeSelectorValue(blockId)}"]`
}

function queryOpenedDoc(rootId: string): HTMLElement | null {
  for (const selector of buildDocWysiwygSelectors(rootId)) {
    const el = document.querySelector(selector) as HTMLElement | null
    if (el)
      return el
  }
  return null
}

export function isDocOpened(rootId: string): boolean {
  return queryOpenedDoc(rootId) !== null
}

export function shouldFallbackToDocTop(blockFound: boolean, docOpened: boolean): boolean {
  return !blockFound && docOpened
}

export function scrollOpenedDocToTop(rootId: string): boolean {
  const wysiwyg = queryOpenedDoc(rootId)
  if (!wysiwyg)
    return false

  wysiwyg.scrollTop = 0
  return true
}

export function scrollOpenedDocToBlock(rootId: string, blockId: string): boolean {
  const wysiwyg = queryOpenedDoc(rootId)
  const blockEl = wysiwyg?.querySelector(`[data-node-id="${escapeSelectorValue(blockId)}"]`) as HTMLElement | null
  if (!blockEl)
    return false

  blockEl.scrollIntoView({ block: 'center', inline: 'nearest' })
  blockEl.focus?.({ preventScroll: true })
  return true
}

export function highlightBlock(blockId: string) {
  if (typeof document === 'undefined')
    return
  let attempts = 0
  const maxAttempts = 20 // 20 * 100ms = 2s
  
  const tryHighlight = () => {
    const el = document.querySelector(`[data-node-id="${escapeSelectorValue(blockId)}"]`) as HTMLElement | null
    if (el) {
      el.classList.add('spm-block-flash')
      setTimeout(() => {
        el.classList.remove('spm-block-flash')
      }, 1500) // 1.5s 后移除闪烁类
      return
    }
    
    attempts++
    if (attempts < maxAttempts) {
      setTimeout(tryHighlight, 100)
    }
  }
  
  tryHighlight()
}

