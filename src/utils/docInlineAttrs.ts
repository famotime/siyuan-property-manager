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

/**
 * MutationObserver 记录的相关性判定（SM-114，纯函数，有单元测试）。
 *
 * 挂载只依赖 `.protyle` / `.protyle-title` / `.protyle-wysiwyg` 的存在性与
 * `data-doc-id` / `data-node-id` 属性。`.protyle-wysiwyg` 内部的块级增删
 * （输入、建块、懒加载、滚动虚拟化）不影响挂载位置，无需调度刷新——
 * 这是全 body childList 观察下最主要的无关变更来源。
 */
export function isRelevantDocInlineMutation(mutation: MutationRecord): boolean {
  // attributes 变更已被 attributeFilter 限定为 data-doc-id / data-node-id，一律相关
  if (mutation.type !== 'childList')
    return true
  const target = mutation.target as HTMLElement | null
  if (!target)
    return true
  if (target.classList?.contains('protyle-wysiwyg'))
    return false
  if (target.closest?.('.protyle-wysiwyg'))
    return false
  return true
}
