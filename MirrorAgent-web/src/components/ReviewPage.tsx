import { useCallback, useEffect, useState } from 'react'
import { fetchToday, fetchAllItems, gradeItem } from '../api/review'
import type { ReviewItem } from '../api/review'
import { fetchQuestionReviews } from '../api/history'
import type { QuestionReview } from '../api/history'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

function cleanTopic(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&#x20;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x2F;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function dueDays(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

function fmtDue(iso: string): string {
  const days = dueDays(iso)
  if (days <= 0) return '今天'
  if (days === 1) return '明天'
  return `${days} 天后`
}

const QUALITIES = [
  { label: '忘了', value: 1, icon: 'x', cls: 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700' },
  { label: '困难', value: 3, icon: 'alert', cls: 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700' },
  { label: '轻松', value: 5, icon: 'check', cls: 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700' },
]

function Icon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }
  if (name === 'refresh') {
    return (
      <svg {...common}>
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    )
  }
  if (name === 'x') {
    return (
      <svg {...common}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    )
  }
  if (name === 'alert') {
    return (
      <svg {...common}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }
  if (name === 'layers') {
    return (
      <svg {...common}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function ReviewPage({ onNavigate }: { onNavigate?: (view: 'chat') => void }) {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const queuePractice = useChatStore((s) => s.queuePractice)
  const [today, setToday] = useState<ReviewItem[] | null>(null)
  const [items, setItems] = useState<ReviewItem[] | null>(null)
  const [error, setError] = useState('')
  const [grading, setGrading] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [gradedCount, setGradedCount] = useState(0)
  const [lastResult, setLastResult] = useState<Record<string, string>>({})
  const [qMap, setQMap] = useState<Record<string, QuestionReview>>({})
  const [detail, setDetail] = useState<QuestionReview | null>(null)
  const [fineOpen, setFineOpen] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    setError('')
    try {
      const [t, all, reviews] = await Promise.all([
        fetchToday(token),
        fetchAllItems(token),
        fetchQuestionReviews(token),
      ])
      setToday(t)
      setItems(all)
      const map: Record<string, QuestionReview> = {}
      for (const r of reviews) {
        for (const q of r.questions ?? []) {
          if (q.questionContent) map[q.questionContent.trim().slice(0, 200)] = q
        }
      }
      setQMap(map)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) { logout(); return }
      setError(err.message || '加载失败')
    }
  }, [token, logout])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const grade = async (topic: string, quality: number) => {
    if (!token) return
    setGrading(topic)
    setError('')
    try {
      const updated = await gradeItem(token, topic, quality)
      setGradedCount((c) => c + 1)
      setLastResult((m) => ({ ...m, [topic]: `下次 ${fmtDue(updated.dueDate)}` }))
      await load()
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) { logout(); return }
      setError(err.message || '操作失败')
    } finally {
      setGrading('')
    }
  }

  const totalReps = (items ?? []).reduce((s, it) => s + (it.reps ?? 0), 0)
  const totalToday = (today?.length ?? 0) + gradedCount
  const progress = totalToday > 0 ? Math.round((gradedCount / totalToday) * 100) : 0

  const buckets: { label: string; range: [number, number] }[] = [
    { label: '今天', range: [0, 0] },
    { label: '明天', range: [1, 1] },
    { label: '3 天内', range: [2, 3] },
    { label: '更晚', range: [4, 9999] },
  ]

  const stats = [
    { label: '今日待复习', value: today?.length ?? 0, tone: 'text-brand-600', bg: 'bg-gray-100', icon: 'calendar' },
    { label: '本次已复习', value: gradedCount, tone: 'text-gray-800', bg: 'bg-gray-100', icon: 'check' },
    { label: '活跃复习项', value: items?.length ?? 0, tone: 'text-gray-800', bg: 'bg-gray-100', icon: 'layers' },
    { label: '累计复习次数', value: totalReps, tone: 'text-gray-800', bg: 'bg-gray-100', icon: 'refresh' },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* 头卡 */}
        <div className="mb-5 rounded-2xl bg-brand-600 p-5 text-white shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">今日复习</h2>
              <p className="mt-1 text-sm text-white/80">按 SM-2 间隔排期，掌握后自动出队</p>
            </div>
            <button
              onClick={async () => {
                setRefreshing(true)
                await load()
                window.setTimeout(() => setRefreshing(false), 400)
              }}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white transition hover:bg-white/25"
            >
              <Icon name="refresh" className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '刷新中…' : '刷新'}
            </button>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-white/80">
              <span>今日进度</span>
              <span>
                {gradedCount}/{totalToday} · {progress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {(!today || !items) && !error && <p className="text-sm text-gray-400">加载中...</p>}

        {today && items && (
          <>
            {/* 统计 */}
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${s.bg} ${s.tone}`}>
                    <Icon name={s.icon} />
                  </div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                  <div className={`mt-0.5 text-2xl font-bold ${s.tone}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* 待复习 */}
            <div className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">
                今日待复习 <span className="font-normal text-gray-400">（{today.length}）</span>
              </h3>
              {today.length === 0 ? (
                <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-4 py-8 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <Icon name="check" className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-brand-700">今天的复习任务已完成</p>
                  <p className="mt-1 text-xs text-gray-500">可以去开始一场模拟面试，或明天再来</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {today.map((it) => (
                    <div key={it.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <div className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="min-w-0 break-all font-medium text-gray-800">{cleanTopic(it.topic)}</span>
                          <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            今天到期
                          </span>
                        </div>
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded-full bg-white px-2 py-0.5">已复习 {it.reps} 次</span>
                          <span className="rounded-full bg-white px-2 py-0.5">间隔 {it.intervalDays} 天</span>
                          <span className="rounded-full bg-white px-2 py-0.5">难度系数 {it.ease?.toFixed?.(1) ?? it.ease}</span>
                        </div>
                        <p className="mb-2 text-xs text-gray-400">先回忆这道题，再按实际掌握程度自评</p>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDetail(qMap[cleanTopic(it.topic).slice(0, 200)] ?? null)}
                              disabled={!qMap[cleanTopic(it.topic).slice(0, 200)]}
                              className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              查看原题
                            </button>
                            <button
                              onClick={() => {
                                queuePractice(cleanTopic(it.topic))
                                onNavigate?.('chat')
                              }}
                              className="cursor-pointer rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs text-brand-700 transition hover:bg-brand-100"
                            >
                              练同类题
                            </button>
                          </div>
                          <button
                            onClick={() => setFineOpen(fineOpen === it.topic ? '' : it.topic)}
                            className="cursor-pointer text-xs text-brand-600 transition hover:text-brand-700"
                          >
                            {fineOpen === it.topic ? '收起精细评分' : '1-5 精细评分'}
                          </button>
                        </div>
                        {fineOpen === it.topic && (
                          <div className="mb-2 flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <button
                                key={v}
                                disabled={grading === it.topic}
                                onClick={() => void grade(it.topic, v)}
                                className="flex-1 cursor-pointer rounded-lg border border-gray-200 bg-white py-1 text-xs text-gray-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {v}
                              </button>
                            ))}
                            <span className="ml-1 shrink-0 text-[10px] text-gray-400">1 忘记 → 5 熟练</span>
                          </div>
                        )}
                        <div className="flex gap-2">
                          {QUALITIES.map((q) => (
                            <button
                              key={q.value}
                              disabled={grading === it.topic}
                              onClick={() => void grade(it.topic, q.value)}
                              className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${q.cls}`}
                            >
                              {grading === it.topic ? (
                                '提交中…'
                              ) : (
                                <>
                                  <Icon name={q.icon} className="h-3.5 w-3.5" />
                                  {q.label}
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 计划 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-gray-700">复习计划</h3>
              <p className="mb-4 text-xs text-gray-400">按 SM-2 间隔排期，掌握后自动出队</p>
              {items.length === 0 ? (
                <p className="text-sm text-gray-400">暂无复习项——完成一场面试后，薄弱主题会自动进入队列</p>
              ) : (
                <div className="space-y-5">
                  {buckets.map((b) => {
                    const list = items.filter((it) => {
                      const d = dueDays(it.dueDate)
                      return d >= b.range[0] && d <= b.range[1]
                    })
                    if (list.length === 0) return null
                    return (
                      <div key={b.label}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600">{b.label}</span>
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{list.length}</span>
                          <span className="h-px flex-1 bg-gray-100" />
                        </div>
                        <div className="space-y-2">
                          {list.map((it) => (
                            <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                                <span className="min-w-0 truncate text-gray-700">{cleanTopic(it.topic)}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2 text-xs">
                                {lastResult[it.topic] && (
                                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">{lastResult[it.topic]}</span>
                                )}
                                <span className="text-gray-400">{fmtDue(it.dueDate)}</span>
                                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-500">间隔 {it.intervalDays} 天</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">原题回顾</h3>
              <button
                onClick={() => setDetail(null)}
                className="cursor-pointer rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                关闭
              </button>
            </div>
            {detail.questionContent && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{detail.questionContent}</p>
            )}
            {detail.userAnswer && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <span className="font-medium text-gray-500">你的回答：</span>
                <span className="whitespace-pre-wrap">{detail.userAnswer}</span>
              </div>
            )}
            {(detail.keyPointsMissed?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-gray-500">当时遗漏的要点</p>
                <div className="flex flex-wrap gap-1.5">
                  {(detail.keyPointsMissed ?? []).map((k, i) => (
                    <span key={i} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {detail.comment && <p className="mt-3 text-xs text-gray-500">{detail.comment}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
