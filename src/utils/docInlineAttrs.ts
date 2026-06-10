export const DOC_INLINE_ATTRS_HOST_CLASS = 'spm-doc-inline-attrs-host'

export type DocInlineAttrsMountPlacement = 'after-title-before-body'

export interface DocInlineAttrsMountInput {
  titlePresent: boolean
  bodyPresent: boolean
  titleNodeId?: string | null
  protyleDocId?: string | null
}

export interface DocInlineAttrsMountPlan {
  docId: string
  hostClass: string
  placement: DocInlineAttrsMountPlacement
}

export function getDocInlineAttrsInitialExpanded(): boolean {
  return false
}

export function resolveDocInlineAttrsMountPlan(input: DocInlineAttrsMountInput): DocInlineAttrsMountPlan | null {
  if (!input.titlePresent || !input.bodyPresent)
    return null

  const docId = input.titleNodeId || input.protyleDocId
  if (!docId)
    return null

  return {
    docId,
    hostClass: DOC_INLINE_ATTRS_HOST_CLASS,
    placement: 'after-title-before-body',
  }
}
