import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../types/message'
import { ScoreCard } from './ScoreCard'
import { ReportCard } from './ReportCard'
import { MatchReportCard } from './MatchReportCard'
import { ReviewPlanCard } from './ReviewPlanCard'

/** 去除 emoji，避免 AI 回复里的表情干扰视觉 */
function stripEmoji(s: string): string {
  return s.replace(/\p{Extended_Pictographic}/gu, '')
}

/** 清理 AI 输出里的 HTML 实体与换行标签，避免原样显示 */
function cleanAiText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x20;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#39;/g, "'")
}

function FileGlyph({ bank }: { bank?: boolean }) {
  const common = {
    className: 'h-4 w-4 shrink-0 text-brand-600',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (bank) {
    return (
      <svg {...common}>
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9" />
        <polyline points="16 14 12 10 8 14" />
        <line x1="12" y1="10" x2="12" y2="21" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.messageType === 'stage') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    )
  }

  if (msg.messageType === 'score') {
    return <ScoreCard msg={msg} />
  }

  if (msg.messageType === 'report') {
    return <ReportCard content={msg.content} />
  }

  if (msg.messageType === 'review_plan') {
    return <ReviewPlanCard content={msg.content} />
  }

  if (msg.messageType === 'upload_result') {
    return (
      <div className="my-3 mx-4 p-4 bg-brand-50 border border-brand-200 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-brand-600 font-medium">题库导入结果</span>
        </div>
        <p className="text-sm text-gray-800">{msg.content}</p>
        {msg.feedback && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">校验失败详情</summary>
            <pre className="mt-1 text-xs text-red-600 whitespace-pre-wrap">{msg.feedback}</pre>
          </details>
        )}
      </div>
    )
  }

  if (msg.messageType === 'rag_evaluation' && msg.ragEvaluation) {
    const eval_ = msg.ragEvaluation
    const pct = (v: number) => `${Math.round(v * 100)}%`
    const barColor = (v: number) => v >= 0.7 ? 'bg-green-500' : v >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
    return (
      <div className="my-3 mx-4 p-4 bg-brand-50 border border-brand-200 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-brand-600 font-medium">题库诊断报告</span>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-3">
          {[
            { label: '精确率', value: eval_.precision ?? eval_.relevance },
            { label: '召回率', value: eval_.recall ?? eval_.completeness },
            { label: '相关性', value: eval_.relevance },
            { label: '综合评分', value: eval_.overall },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-lg font-bold text-gray-800">{pct(value)}</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                <div className={`h-1.5 rounded-full ${barColor(value)}`} style={{ width: pct(value) }} />
              </div>
            </div>
          ))}
        </div>
        {eval_.skill_coverage && eval_.skill_coverage.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">各技能方向</div>
            <div className="flex flex-wrap gap-1.5">
              {eval_.skill_coverage.map((sc) => (
                <span
                  key={sc.skill}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    sc.quality === '充足' ? 'bg-green-100 text-green-700' :
                    sc.quality === '偏少' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}
                >
                  {sc.skill}: {sc.quality}
                </span>
              ))}
            </div>
          </div>
        )}
        {eval_.summary && (
          <p className="text-sm text-gray-700">{eval_.summary}</p>
        )}
      </div>
    )
  }

  if (msg.messageType === 'match_report') {
    return <MatchReportCard content={msg.content} />
  }

  const isUser = msg.role === 'user'

  // 用户发送的文件消息：逐文件带图标展示
  if (msg.messageType === 'file') {
    const lines = msg.content.split('\n').map(stripEmoji).filter((l) => l.trim().length > 0)
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-brand-900">
          <div className="space-y-1.5">
            {lines.map((line, i) => {
              const bank = line.startsWith('上传题库：')
              const label = bank ? line.slice('上传题库：'.length) : line
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileGlyph bank={bank} />
                  <span className="min-w-0 break-all">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'border border-brand-100 bg-brand-50 text-brand-900'
            : 'border border-gray-200/80 bg-white text-gray-900 shadow-sm'
        }`}
      >
        {msg.messageType === 'question' && (
          <div className="text-xs font-medium opacity-70 mb-1">
            第 {msg.questionNum} 题
          </div>
        )}
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanAiText(stripEmoji(msg.content))}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}