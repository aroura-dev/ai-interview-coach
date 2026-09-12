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

export function ReportHeaderCards({ items }: { items: ReportHeaderItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="text-xs text-gray-500">{it.label}</div>
          <div className="mt-0.5 break-all text-sm font-medium text-gray-800">{it.value}</div>
        </div>
      ))}
    </div>
  )
}