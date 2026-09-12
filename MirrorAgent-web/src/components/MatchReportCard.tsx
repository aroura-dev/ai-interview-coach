import { useState } from 'react'
import { ReportHeaderCards } from './ReportSummary'
import { extractReportHeader } from './reportUtils'
import { RichMarkdown } from './RichMarkdown'

export function MatchReportCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(true)
  const header = extractReportHeader(content)

  return (
    <div className="mx-4 my-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50">
      <div className="flex items-center justify-between bg-brand-50 px-4 py-3">
        <span className="font-medium text-brand-800">JD × 简历 · 匹配自检报告</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-brand-600 transition hover:text-brand-700"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>
      {expanded && (
        <div className="bg-white px-4 py-4">
          {header.items.length > 0 && (
            <div className="mb-4">
              <ReportHeaderCards items={header.items} />
            </div>
          )}
          <RichMarkdown markdown={header.rest} />
        </div>
      )}
    </div>
  )
}