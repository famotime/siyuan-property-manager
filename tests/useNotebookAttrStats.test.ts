import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function readComposable(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  return fs.readFileSync(path.join(__dirname, '../src/composables/useNotebookAttrStats.ts'), 'utf8')
}

// 回归 1：内核 `/api/attr/setBlockAttrs` 的 id 契约是单个字符串
// （`apicontract.SetBlockAttrsRequest.ID string`，见 siyuan-note 源码），
// 传数组会被内核绑定拒绝。批量操作必须逐块写入（分片并发）。
test('batchEditAttr/batchDeleteAttr write per block instead of passing an id array', () => {
  const content = readComposable()
  assert.ok(!content.includes('setBlockAttrs(bIds'), 'must not pass an id array to setBlockAttrs')
  assert.match(content, /Promise\.allSettled\(chunk\.map\(t => setBlockAttrs\(t\.id, t\.attrs\)\)\)/, 'batch ops must fan out one setBlockAttrs per block id')
})

// 回归 2：当前文档属性必须经 mergeCurrentDocAttrRows 并入统计行。
// 旧代码构造 docCustomMap 后传给只收一个参数的 collectCustomAttrGroups，被静默忽略。
test('load() merges current-doc attr rows via mergeCurrentDocAttrRows', () => {
  const content = readComposable()
  assert.match(content, /mergeCurrentDocAttrRows\(rows, docAttrRows\)/, 'notebook stats must merge current-doc rows')
  assert.ok(!content.includes('docCustomMap'), 'dead docCustomMap construction must not be reintroduced')
  assert.match(content, /collectCustomAttrGroups\(mergedRows\)/, 'groups must be collected from merged rows')
})

test('batchRenameAttrKey writes per block with new key and clears old key', () => {
  const content = readComposable()
  assert.match(content, /export async function batchRenameAttrKey/, 'must export batchRenameAttrKey')
  assert.match(content, /\[newKey\]: r\.value \?\? '',\s*\[oldKey\]: ''/, 'must set newKey and clear oldKey per block')
})
