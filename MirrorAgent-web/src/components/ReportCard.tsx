import { useState } from 'react'
import { ReportHeaderCards } from './ReportSummary'
import { extractReportHeader } from './reportUtils'
import { RichMarkdown } from './RichMarkdown'

export function ReportCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const header = extractReportHeader(content)

  return (
    <div className="mx-4 my-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-brand-100"
      >
        <span className="font-medium text-brand-800">面试评估报告</span>
        <span className="text-sm text-brand-600">{expanded ? '收起' : '展开'}</span>
      </button>
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