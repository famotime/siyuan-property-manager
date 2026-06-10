import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DOC_INLINE_ATTRS_HOST_CLASS,
  getDocInlineAttrsInitialExpanded,
  resolveDocInlineAttrsMountPlan,
} from '../src/utils/docInlineAttrs.ts'

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
