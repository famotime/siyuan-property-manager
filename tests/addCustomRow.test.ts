import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// vite 构建不做类型检查，.vue 内「使用但未导入」的标识符只能在运行时暴露为
// ReferenceError（见 inferAttrType 缺导入缺陷）。用源文本断言钉住关键导入。
test('AddCustomRow.vue imports inferAttrType that it uses', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const content = fs.readFileSync(path.join(__dirname, '../src/components/AddCustomRow.vue'), 'utf8')

  const uses = content.match(/\binferAttrType\(/g)?.length ?? 0
  assert.ok(uses > 0, 'AddCustomRow.vue should still use inferAttrType; otherwise prune this test with the usage')
  assert.match(
    content,
    /import\s*\{[^}]*\binferAttrType\b[^}]*\}\s*from\s*'@\/utils\/typeInference'/,
    'AddCustomRow.vue must import inferAttrType from @/utils/typeInference',
  )
})

test('NotebookAttrStats.vue pairs selection key build with parse (regression: space-join vs NUL-parse mismatch)', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const content = fs.readFileSync(path.join(__dirname, '../src/components/NotebookAttrStats.vue'), 'utf8')

  assert.match(
    content,
    /import\s*\{[^}]*\bmakeSelectionKey\b[^}]*\bparseSelectionKey\b[^}]*\}\s*from\s*'@\/utils\/selectionKey'/,
    'NotebookAttrStats.vue must use the paired makeSelectionKey/parseSelectionKey helpers',
  )
  assert.ok(!content.includes('function makeKey('), 'local makeKey must not be reintroduced')
  assert.ok(!content.includes(`indexOf('\\x00')`), 'ad-hoc NUL parsing must not be reintroduced')
})
