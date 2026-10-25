/** 复制文本到剪贴板；失败时静默返回 false（统计面板复制块 ID 等场景，不打断交互）。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  }
  catch {
    return false
  }
}
