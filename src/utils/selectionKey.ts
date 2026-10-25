/**
 * 统计面板批量操作的选中键。
 *
 * 属性值可含空格（如多选值以 ", " 连接），因此不可用空格作分隔符，
 * 统一用 NUL（`\u0000`）分隔「属性名」与「属性值」。
 * 拼接与解析必须成对使用本模块，防止两侧分隔符漂移。
 */

const SEP = '\u0000'

export function makeSelectionKey(name: string, value: string): string {
  return `${name}${SEP}${value}`
}

export function parseSelectionKey(key: string): { name: string, value: string } | null {
  const sep = key.indexOf(SEP)
  if (sep < 0)
    return null
  return { name: key.slice(0, sep), value: key.slice(sep + 1) }
}
