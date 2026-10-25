/**
 * 生成符合思源标准风格的 ID：`YYYYMMDDHHmmss-<7位随机串>`。
 * 与内核 `kernel/util` 的时间戳 ID 同构，供建库时生成 avID / keyID / viewID。
 */
export function generateSiyuanId(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const timestamp = `${yyyy}${MM}${dd}${hh}${mm}${ss}`
  const randomStr = Math.random().toString(36).slice(2, 9)
  return `${timestamp}-${randomStr}`
}
