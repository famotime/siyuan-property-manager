import test from 'node:test'
import assert from 'node:assert/strict'
import {
  removeKeyIfBlankOptimistic,
  rollbackOptimisticValue,
  rollbackRename,
} from '../src/utils/attrLocalState.ts'

// SM-107：乐观更新与「最新写」守卫——本地值仍等于本次乐观值时才允许变动。

test('rollbackOptimisticValue restores previous value only when local value still matches', () => {
  // 常规回滚：本地仍是本次乐观值
  const raw = { 'custom-a': 'v1' }
  assert.deepEqual(
    rollbackOptimisticValue(raw, 'custom-a', 'v1', 'v0'),
    { 'custom-a': 'v0' },
  )

  // 更晚的写入已把本地改为 v2：早失败的写入不得覆盖它
  const raced = { 'custom-a': 'v2' }
  assert.equal(rollbackOptimisticValue(raced, 'custom-a', 'v1', 'v0'), null)
  assert.deepEqual(raced, { 'custom-a': 'v2' }, '拦截时不产生副作用')
})

test('rollbackOptimisticValue deletes the key when it did not exist before', () => {
  const raw = { 'custom-a': 'new' }
  assert.deepEqual(rollbackOptimisticValue(raw, 'custom-a', 'new', undefined), {})
})

test('removeKeyIfBlankOptimistic deletes only when local value is still the blank optimistic value', () => {
  // 删除写（空串）成功后，本地仍为空串 → 移除 key
  assert.deepEqual(removeKeyIfBlankOptimistic({ 'custom-a': '' }, 'custom-a'), {})

  // 更晚的写入已填入新值：旧的删除不得吞掉它
  const raced = { 'custom-a': 'abc' }
  assert.equal(removeKeyIfBlankOptimistic(raced, 'custom-a'), null)
  assert.deepEqual(raced, { 'custom-a': 'abc' })

  // key 本来就不存在（例如服务端已删除后本地无此键）→ 无需变动
  assert.equal(removeKeyIfBlankOptimistic({}, 'custom-a'), null)
})

test('rollbackRename restores the old key only when neither side was touched by later writes', () => {
  // 常规回滚
  assert.deepEqual(
    rollbackRename({ 'custom-b': 'val' }, 'custom-a', 'custom-b', 'val'),
    { 'custom-a': 'val' },
  )

  // 更晚的写入已修改新键的值：不回滚
  assert.equal(rollbackRename({ 'custom-b': 'changed' }, 'custom-a', 'custom-b', 'val'), null)

  // 旧键已被其他写入重新创建：不回滚（避免覆盖重建值）
  assert.equal(
    rollbackRename({ 'custom-b': 'val', 'custom-a': 'recreated' }, 'custom-a', 'custom-b', 'val'),
    null,
  )
})
