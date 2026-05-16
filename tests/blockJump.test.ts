import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBlockSelector,
  buildDocWysiwygSelectors,
  shouldFallbackToDocTop,
} from '../src/utils/blockJump.ts'

test('block selector targets an opened document before locating the block', () => {
  assert.equal(
    buildBlockSelector('doc-1', 'block-1'),
    '.protyle[data-doc-id="doc-1"] .protyle-wysiwyg [data-node-id="block-1"]',
  )
})

test('doc selector targets opened document wysiwyg container', () => {
  assert.deepEqual(
    buildDocWysiwygSelectors('doc-1'),
    [
    '.protyle[data-doc-id="doc-1"] .protyle-wysiwyg',
      '.protyle:has(.protyle-title[data-node-id="doc-1"]) .protyle-wysiwyg',
    ],
  )
})

test('opened doc falls back to document top when target block is not found', () => {
  assert.equal(shouldFallbackToDocTop(false, true), true)
  assert.equal(shouldFallbackToDocTop(false, false), false)
  assert.equal(shouldFallbackToDocTop(true, true), false)
})
