import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeAvSyncMappings, normalizeAvSyncEntries, serializeAvSyncEntries } from '../src/utils/avSyncRegistry.ts'
import type { AvSyncRegistryEntry } from '../src/types/avSync.d.ts'

function makeEntry(avID: string, patch: Partial<AvSyncRegistryEntry> = {}): AvSyncRegistryEntry {
  return {
    avID,
    name: '测试库',
    enabled: true,
    mapping: { 'key-1': 'custom-status' },
    updatedAt: 123,
    ...patch,
  }
}

test('serializeAvSyncEntries sorts keys so identical content yields identical JSON', () => {
  const a: Record<string, AvSyncRegistryEntry> = {
    'av-b': makeEntry('av-b'),
    'av-a': makeEntry('av-a'),
  }
  const b: Record<string, AvSyncRegistryEntry> = {
    'av-a': makeEntry('av-a'),
    'av-b': makeEntry('av-b'),
  }
  assert.equal(serializeAvSyncEntries(a), serializeAvSyncEntries(b))
  assert.deepEqual(Object.keys(JSON.parse(serializeAvSyncEntries(a))), ['av-a', 'av-b'])
})

test('serialize/normalize round-trips registry entries', () => {
  const entries = { 'av-1': makeEntry('av-1') }
  const restored = normalizeAvSyncEntries(JSON.parse(serializeAvSyncEntries(entries)))
  assert.deepEqual(restored, entries)
})

test('normalizeAvSyncEntries returns empty object for non-object input', () => {
  assert.deepEqual(normalizeAvSyncEntries(null), {})
  assert.deepEqual(normalizeAvSyncEntries(undefined), {})
  assert.deepEqual(normalizeAvSyncEntries('junk'), {})
  assert.deepEqual(normalizeAvSyncEntries([]), {})
})

test('normalizeAvSyncEntries drops non-object entries and fills defaults', () => {
  const restored = normalizeAvSyncEntries({
    'av-ok': { mapping: { k: 'custom-tags' } },
    'av-null': null,
    'av-num': 42,
    'av-str': 'x',
  })
  assert.deepEqual(Object.keys(restored), ['av-ok'])
  assert.deepEqual(restored['av-ok'], {
    avID: 'av-ok',
    name: '',
    enabled: false,
    mapping: { k: 'custom-tags' },
    updatedAt: 0,
  })
})

test('normalizeAvSyncEntries filters unsyncable mapping values', () => {
  const restored = normalizeAvSyncEntries({
    'av-1': {
      mapping: {
        k1: 'custom-status', // 可同步，保留
        k2: 'status', // 无 custom- 前缀
        k3: 'custom-avs', // 内核保留键
        k4: 'custom-sy-av-s-text-av1', // 内核保留前缀
        k5: 123, // 非字符串
      },
    },
  })
  assert.deepEqual(Object.keys(restored['av-1'].mapping), ['k1'])
})

test('normalizeAvSyncEntries only accepts enabled === true and numeric updatedAt', () => {
  const restored = normalizeAvSyncEntries({
    'av-1': { enabled: 'true', updatedAt: '456' },
    'av-2': { enabled: true, updatedAt: 456 },
  })
  assert.equal(restored['av-1'].enabled, false)
  assert.equal(restored['av-1'].updatedAt, 0)
  assert.equal(restored['av-2'].enabled, true)
  assert.equal(restored['av-2'].updatedAt, 456)
})

test('mergeAvSyncMappings returns null for empty derived', () => {
  assert.equal(mergeAvSyncMappings({ k1: 'custom-a' }, {}), null)
})

test('mergeAvSyncMappings is idempotent when nothing changes', () => {
  const existing = { k1: 'custom-a' }
  assert.equal(mergeAvSyncMappings(existing, { k1: 'custom-a' }), null)
  // 二次合并（登记表已吸收第一次结果）仍无变化
  const merged = mergeAvSyncMappings(existing, { k2: 'custom-b' })
  assert.ok(merged)
  assert.equal(mergeAvSyncMappings(merged!, { k2: 'custom-b' }), null)
})

test('mergeAvSyncMappings adds new keys and overrides conflicting values', () => {
  const merged = mergeAvSyncMappings(
    { k1: 'custom-old', k2: 'custom-keep' },
    { k1: 'custom-new', k3: 'custom-add' },
  )
  assert.deepEqual(merged, { k1: 'custom-new', k2: 'custom-keep', k3: 'custom-add' })
})

test('mergeAvSyncMappings does not mutate the existing mapping', () => {
  const existing = { k1: 'custom-a' }
  mergeAvSyncMappings(existing, { k2: 'custom-b' })
  assert.deepEqual(existing, { k1: 'custom-a' })
})
