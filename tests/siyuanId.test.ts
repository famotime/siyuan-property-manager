import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSiyuanId } from '../src/utils/siyuanId.ts'

test('generateSiyuanId matches siyuan style YYYYMMDDHHmmss-random', () => {
  const id = generateSiyuanId()
  assert.match(id, /^\d{14}-[a-z0-9]{7}$/)
  const ts = new Date()
  const prefix = String(ts.getFullYear())
  assert.ok(id.startsWith(prefix), `id should start with current year: ${id}`)
})

test('generateSiyuanId is unique across calls', () => {
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++)
    seen.add(generateSiyuanId())
  assert.equal(seen.size, 200)
})
