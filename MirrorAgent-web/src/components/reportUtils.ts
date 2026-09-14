export interface ReportHeaderItem {
  label: string
  value: string
}

/** 从报告 markdown 开头提取 **标签**：值 摘要块，返回条目与剩余正文 */
export function extractReportHeader(md: string): { items: ReportHeaderItem[]; rest: string } {
  const lines = md.split('\n')
  const items: ReportHeaderItem[] = []
  let idx = 0
  while (idx < lines.length) {
    const t = lines[idx].trim()
    if (!t) { idx++; continue }
    // 报告常以 "# 面试评估报告" 之类标题开头：在收集到信息前跳过标题行
    if (/^#/.test(t)) {
      if (items.length === 0) { idx++; continue }
      break
    }
    const m = t.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/)
    if (!m) break
    items.push({
      label: m[1].replace(/\*\*/g, '').trim(),
      value: m[2].replace(/\*\*/g, '').trim(),
    })
    idx++
  }
  const rest = lines.slice(idx).join('\n').replace(/^\s*\n+/, '')
  return { items, rest }
}