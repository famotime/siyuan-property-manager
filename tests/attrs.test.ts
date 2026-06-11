import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTOM_KEY_PREFIX,
  isCustomKey,
  isReadonlyKey,
  isValidCustomSuffix,
  READONLY_INTERNAL_KEYS,
} from '../src/constants/attrs.ts'

// ---- isCustomKey ----

test('isCustomKey returns true for keys starting with custom-', () => {
  assert.equal(isCustomKey('custom-myAttr'), true)
  assert.equal(isCustomKey('custom-'), true)
})

test('isCustomKey returns false for internal keys', () => {
  assert.equal(isCustomKey('id'), false)
  assert.equal(isCustomKey('name'), false)
  assert.equal(isCustomKey(''), false)
})

// ---- isReadonlyKey ----

test('isReadonlyKey returns true for all READONLY_INTERNAL_KEYS', () => {
  for (const key of READONLY_INTERNAL_KEYS) {
    assert.equal(isReadonlyKey(key), true, `expected "${key}" to be readonly`)
  }
})

test('isReadonlyKey returns false for editable keys', () => {
  assert.equal(isReadonlyKey('name'), false)
  assert.equal(isReadonlyKey('alias'), false)
  assert.equal(isReadonlyKey('memo'), false)
  assert.equal(isReadonlyKey('custom-test'), false)
})

// ---- isValidCustomSuffix ----

test('isValidCustomSuffix accepts alphanumeric suffixes', () => {
  assert.equal(isValidCustomSuffix('myAttr'), true)
  assert.equal(isValidCustomSuffix('attr123'), true)
  assert.equal(isValidCustomSuffix('my_attr'), true)
  assert.equal(isValidCustomSuffix('my-attr'), true)
  assert.equal(isValidCustomSuffix('a'), true)
})

test('isValidCustomSuffix rejects empty or invalid suffixes', () => {
  assert.equal(isValidCustomSuffix(''), false)
  assert.equal(isValidCustomSuffix('-start'), false)
  assert.equal(isValidCustomSuffix('_start'), false)
  assert.equal(isValidCustomSuffix('has space'), false)
  assert.equal(isValidCustomSuffix('has@special'), false)
})

// ---- CUSTOM_KEY_PREFIX ----

test('CUSTOM_KEY_PREFIX is custom-', () => {
  assert.equal(CUSTOM_KEY_PREFIX, 'custom-')
})
