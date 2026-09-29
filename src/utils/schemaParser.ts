export interface ParsedKeyAndLabel {
  key: string
  label?: string
}

/**
 * 解析用户输入的属性名与备注项。
 * 兼容中英文括号、前后空格、中文全角括号、首尾空白。
 *
 * 示例：
 * "status (状态)" -> { key: "status", label: "状态" }
 * "custom-status（状态）" -> { key: "custom-status", label: "状态" }
 * "status(状态)" -> { key: "status", label: "状态" }
 * "status （ 状态 ）" -> { key: "status", label: "状态" }
 * "（状态）status" -> { key: "status", label: "状态" }
 * "status" -> { key: "status", label: undefined }
 */
export function parseKeyAndLabel(input: string): ParsedKeyAndLabel {
  if (!input || typeof input !== 'string')
    return { key: '' }

  const trimmed = input.trim()
  if (!trimmed)
    return { key: '' }

  // 1. 优先匹配 key + 括号备注：如 "status (状态)"、"status（状态）"、"status(状态)"
  const standardMatch = trimmed.match(/^([^(（]+?)\s*[（(](.*?)[）)]\s*$/)
  if (standardMatch) {
    const rawKey = standardMatch[1].trim()
    const rawLabel = standardMatch[2].trim()
    return {
      key: rawKey,
      label: rawLabel || undefined,
    }
  }

  // 2. 容错匹配前置括号备注：如 "（状态）status" 或 "(状态) status"
  const prefixMatch = trimmed.match(/^[（(](.*?)[）)]\s*([^(（]+?)\s*$/)
  if (prefixMatch) {
    const rawLabel = prefixMatch[1].trim()
    const rawKey = prefixMatch[2].trim()
    return {
      key: rawKey,
      label: rawLabel || undefined,
    }
  }

  // 3. 无括号普通属性名
  return {
    key: trimmed,
  }
}

/**
 * 解析选项输入字符串，容错中英文逗号、连续逗号、前后空格等。
 *
 * 示例：
 * "待办, 进行中，已完成" -> ["待办", "进行中", "已完成"]
 * "  P0 - 紧急 , P1 - 高 ， P2 - 中 ,  " -> ["P0 - 紧急", "P1 - 高", "P2 - 中"]
 * "单个选项" -> ["单个选项"]
 * "，，, ," -> []
 */
export function parseOptionInputs(raw: string): string[] {
  if (!raw || typeof raw !== 'string')
    return []

  const parts = raw.split(/[,，]/)
  const result: string[] = []
  const seen = new Set<string>()

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      result.push(trimmed)
    }
  }

  return result
}
