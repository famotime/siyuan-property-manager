import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOC_INLINE_ATTRS_HOST_CLASS,
  getDocInlineAttrsInitialExpanded,
  isRelevantDocInlineMutation,
  resolveDocInlineAttrsMountPlan,
} from '../src/utils/docInlineAttrs.ts'

function fakeElement(opts: { isWysiwyg?: boolean, insideWysiwyg?: boolean }): Node {
  return {
    classList: { contains: (cls: string) => opts.isWysiwyg === true && cls === 'protyle-wysiwyg' },
    closest: (selector: string) =>
      (opts.insideWysiwyg === true && selector === '.protyle-wysiwyg' ? {} : null),
  } as unknown as Node
}

function record(type: string, target: Node | null): MutationRecord {
  return { type, target } as unknown as MutationRecord
}

test('wysiwyg-internal block edits do not trigger doc-inline refresh scheduling', () => {
  const wysiwyg = fakeElement({ isWysiwyg: true })
  const innerBlock = fakeElement({ insideWysiwyg: true })
  const protyle = fakeElement({})

  // 目标是 wysiwyg 自身或其内部节点（击键建块、懒加载）→ 不相关
  assert.equal(isRelevantDocInlineMutation(record('childList', wysiwyg)), false)
  assert.equal(isRelevantDocInlineMutation(record('childList', innerBlock)), false)
  // protyle 结构级变更（新增/移除 protyle、标题出现、host 重插）→ 相关
  assert.equal(isRelevantDocInlineMutation(record('childList', protyle)), true)
  assert.equal(isRelevantDocInlineMutation(record('childList', null)), true)
  // 属性变更已被 observer 的 attributeFilter 限定，一律相关
  assert.equal(isRelevantDocInlineMutation(record('attributes', protyle)), true)
  assert.equal(isRelevantDocInlineMutation(record('characterData', innerBlock)), true)
})

test('document inline attrs are collapsed by default', () => {
  assert.equal(getDocInlineAttrsInitialExpanded(), false)
})

test('document inline attrs mount between the document title and body using the title node id', () => {
  assert.deepEqual(
    resolveDocInlineAttrsMountPlan({
      bodyPresent: true,
      protyleDocId: 'fallback-doc',
      titleNodeId: 'title-doc',
      titlePresent: true,
    }),
    {
      docId: 'title-doc',
      hostClass: DOC_INLINE_ATTRS_HOST_CLASS,
      placement: 'after-title-before-body',
    },
  )
})

test('document inline attrs fall back to the protyle doc id when the title has no node id', () => {
  assert.deepEqual(
    resolveDocInlineAttrsMountPlan({
      bodyPresent: true,
      protyleDocId: 'protyle-doc',
      titleNodeId: null,
      titlePresent: true,
    }),
    {
      docId: 'protyle-doc',
      hostClass: DOC_INLINE_ATTRS_HOST_CLASS,
      placement: 'after-title-before-body',
    },
  )
})

test('document inline attrs require both title and body so the panel stays above the document body', () => {
  assert.equal(
    resolveDocInlineAttrsMountPlan({
      bodyPresent: false,
      protyleDocId: 'doc-1',
      titleNodeId: 'doc-1',
      titlePresent: true,
    }),
    null,
  )
})
