import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDateDisplay, formatNumberDisplay } from '../src/utils/valueFormat.ts'

test('formatNumberDisplay - undefined format returns value untouched', () => {
  assert.equal(formatNumberDisplay('1234.50', undefined), '1234.50')
  assert.equal(formatNumberDisplay('', undefined), '')
})

test('formatNumberDisplay - non-numeric values pass through', () => {
  assert.equal(formatNumberDisplay('abc', 'number'), 'abc')
  assert.equal(formatNumberDisplay('12px', 'percent'), '12px')
})

test('formatNumberDisplay - number format groups thousands and keeps decimals', () => {
  assert.equal(formatNumberDisplay('1234567', 'number'), '1,234,567')
  assert.equal(formatNumberDisplay('1234567.89', 'number'), '1,234,567.89')
  assert.equal(formatNumberDisplay('-9876.5', 'number'), '-9,876.5')
  assert.equal(formatNumberDisplay('42', 'number'), '42')
})

test('formatNumberDisplay - currency prefixes CNY symbol', () => {
  assert.equal(formatNumberDisplay('1234.5', 'currency'), '¥1,234.5')
  assert.equal(formatNumberDisplay('-50', 'currency'), '¥-50')
})

test('formatNumberDisplay - percent appends suffix', () => {
  assert.equal(formatNumberDisplay('62.5', 'percent'), '62.5%')
  assert.equal(formatNumberDisplay('1000000', 'percent'), '1,000,000%')
})

test('formatDateDisplay - no format or unmatched value returns original', () => {
  assert.equal(formatDateDisplay('2026-01-02', undefined), '2026-01-02')
  assert.equal(formatDateDisplay('not a date', 'YYYY-MM-DD'), 'not a date')
  assert.equal(formatDateDisplay('', 'YYYY-MM-DD HH:mm'), '')
})

test('formatDateDisplay - date-only format strips time part', () => {
  assert.equal(formatDateDisplay('2026-01-02 10:30:00', 'YYYY-MM-DD'), '2026-01-02')
  assert.equal(formatDateDisplay('2026-01-02 10:30', 'YYYY-MM-DD'), '2026-01-02')
})

test('formatDateDisplay - date-only value is kept as-is even when format wants time', () => {
  assert.equal(formatDateDisplay('2026-01-02', 'YYYY-MM-DD HH:mm'), '2026-01-02')
  assert.equal(formatDateDisplay('2026-01-02', 'YYYY-MM-DD HH:mm:ss'), '2026-01-02')
})

test('formatDateDisplay - value with time and time format kept verbatim', () => {
  assert.equal(formatDateDisplay('2026-01-02 10:30', 'YYYY-MM-DD HH:mm'), '2026-01-02 10:30')
  assert.equal(formatDateDisplay('2026-01-02 10:30:45', 'YYYY-MM-DD HH:mm:ss'), '2026-01-02 10:30:45')
})
