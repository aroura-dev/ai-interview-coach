import { useCallback, useEffect, useState } from 'react'
import { ReportHeaderCards } from './ReportSummary'
import { extractReportHeader } from './reportUtils'
import { RichMarkdown } from './RichMarkdown'

import { fetchHistory, fetchHistoryDetail } from '../api/history'
import type { HistoryDetail, HistoryItem } from '../api/history'
import { useAuthStore } from '../store/authStore'
import { importReview } from '../api/review'
import { useChatStore, listLocalSessions } from '../store/chatStore'
import { ConfirmDialog } from './ConfirmDialog'

import type { LocalSession } from '../store/chatHistory'

function formatTime(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** 去掉正文开头与区块标题重复的 H1（如 # 面试评估报告） */
function stripSectionTitle(md: string): string {
  return md.replace(/^\s*#+\s*(面试评估报告|个性化复习计划|评估报告|复习计划)[^\n]*\n+/, '')
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

interface HistoryPageProps {
  onOpenChat?: () => void
}

export function HistoryPage({ onOpenChat }: HistoryPageProps) {
  const token = useAuthStore((s) => s.token)
  const username = useAuthStore((s) => s.username)
  const logout = useAuthStore((s) => s.logout)
  const openSession = useChatStore((s) => s.openSession)
  const removeSession = useChatStore((s) => s.removeSession)
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [localSessions, setLocalSessions] = useState<LocalSession[]>([])
  const [toDelete, setToDelete] = useState<LocalSession | null>(null)
  const [addedReviews, setAddedReviews] = useState<number[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const reloadLocal = useCallback(() => {
    setLocalSessions(username ? listLocalSessions(username) : [])
  }, [username])

  const loadList = useCallback(async () => {
    if (!token) return
    setError('')
    reloadLocal()
    try {
      setItems(await fetchHistory(token))
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) { logout(); return }
      setError(err.message || '加载失败')
      setItems([])
    }
  }, [token, logout, reloadLocal])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadList() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadList])

  const openDetail = async (sessionId: string) => {
    if (!token) return
    setLoadingDetail(true)
    setError('')
    try {
      setDetail(await fetchHistoryDetail(token, sessionId))
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 401) { logout(); return }
      setError(err.message || '加载失败')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleImportReview = async (i: number, content?: string) => {
    if (!token || !content) return
    try {
      await importReview(token, content)
      setAddedReviews((p) => (p.includes(i) ? p : [...p, i]))
    } catch { /* 导入失败静默 */ }
  }

  const openLocal = (id: string) => {
    openSession(id)
    onOpenChat?.()
  }

  const reportHeader = detail ? extractReportHeader(detail.report) : null

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {detail ? (
        <div className="max-w-4xl mx-auto py-8 px-4">
          <button
            onClick={() => setDetail(null)}
            className="mb-5 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
          >
            ← 返回列表
          </button>
          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {detail.position || '未命名岗位'}
              </h2>
              <div className="flex flex-col items-end gap-1.5">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  综合得分
                  <b className={`text-2xl leading-none ${scoreColor(detail.overallScore)}`}>
                    {detail.overallScore}
                  </b>
                </span>
                <span className="text-xs text-gray-400">{formatTime(detail.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden mb-4">
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 font-medium text-blue-800">
              面试评估报告
            </div>
            <div className="px-6 py-5">
              {reportHeader && reportHeader.items.length > 0 && (
                <ReportHeaderCards items={reportHeader.items} />
              )}
              <RichMarkdown markdown={stripSectionTitle(reportHeader ? reportHeader.rest : detail.report)} />
            </div>
          </div>

          {detail.questions && detail.questions.length > 0 && (
            <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-medium text-gray-800">
                每题得分明细（{detail.questions.length}）
              </div>
              <div className="divide-y divide-gray-100">
                {detail.questions.map((q, i) => {
                  const sc = Math.round(q.score ?? 0)
                  return (
                    <div key={i} className="px-5 py-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800">第 {i + 1} 题</span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`text-lg font-bold leading-none ${scoreColor(sc)}`}>{sc}</span>
                          {q.questionContent && (
                            <button
                              onClick={() => void handleImportReview(i, q.questionContent)}
                              disabled={addedReviews.includes(i)}
                              className={`rounded-md px-2 py-1 text-xs transition ${
                                addedReviews.includes(i)
                                  ? 'cursor-default bg-gray-100 text-gray-400'
                                  : 'cursor-pointer border border-brand-200 text-brand-700 hover:bg-brand-50'
                              }`}
                            >
                              {addedReviews.includes(i) ? '已加入复习' : '加入复习'}
                            </button>
                          )}
                        </div>
                      </div>
                      {q.questionContent && (
                        <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                          {q.questionContent}
                        </div>
                      )}
                      {q.userAnswer ? (
                        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                          <span className="font-medium text-gray-500">你的回答：</span>
                          <span className="whitespace-pre-wrap">{q.userAnswer}</span>
                        </div>
                      ) : null}
                      {q.comment && (
                        <p className="mt-2 text-xs text-gray-500">{q.comment}</p>
                      )}
                      {(q.keyPointsHit && q.keyPointsHit.length > 0) || (q.keyPointsMissed && q.keyPointsMissed.length > 0) ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(q.keyPointsHit ?? []).map((k, ki) => (
                            <span key={`h${ki}`} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                              ✓ {k}
                            </span>
                          ))}
                          {(q.keyPointsMissed ?? []).map((k, ki) => (
                            <span key={`m${ki}`} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                              ✗ {k}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-brand-200 overflow-hidden">
            <div className="px-5 py-3 bg-brand-50 border-b border-brand-200 font-medium text-brand-800">
              复习计划
            </div>
            <div className="px-6 py-5">
              <RichMarkdown markdown={stripSectionTitle(detail.reviewPlan)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto py-6 px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">历史会话</h2>
            <button
              onClick={async () => {
                setRefreshing(true)
                await loadList()
                window.setTimeout(() => setRefreshing(false), 500)
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
            >
              <svg
                className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {refreshing ? '刷新中…' : '刷新'}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <h3 className="mb-2 text-sm font-semibold text-gray-700">面试记录</h3>
          {items === null ? (
            <p className="text-sm text-gray-400">加载中...</p>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-400">还没有面试记录，去开始一场模拟面试吧</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <button
                  key={it.sessionId}
                  onClick={() => void openDetail(it.sessionId)}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-800">
                        {it.position || '未命名岗位'}
                      </div>
                      <div className="mt-1 text-xs text-gray-400">{formatTime(it.createdAt)}</div>
                    </div>
                    <span className={`shrink-0 text-xl font-bold leading-none ${scoreColor(it.overallScore)}`}>
                      {it.overallScore}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* 本地对话记录 */}
          {localSessions.length > 0 && (
            <div className="mb-8 mt-8">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                对话记录

              </h3>
              <div className="space-y-2">
              {localSessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openLocal(s.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-brand-300 hover:shadow-sm"
                >

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800">{s.title}</span>
                    <span className="mt-0.5 flex items-center gap-3 text-xs">
                      <span className="text-gray-400">{formatTime(s.updatedAt)}</span>
                      <span className="text-gray-500">{s.messages.length} 条消息</span>
                    </span>
                  </span>
                  <svg className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setToDelete(s)
                    }}
                    className="shrink-0 rounded p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                    title="删除"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </span>
                </button>
              ))}
              </div>
            </div>
          )}
          {loadingDetail && <p className="text-sm text-gray-400 mt-3">加载中...</p>}
        </div>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="删除对话记录？"
        desc={toDelete ? `${toDelete.title} 的聊天记录将被删除，删除后无法恢复。` : undefined}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            removeSession(toDelete.id)
            reloadLocal()
          }
          setToDelete(null)
        }}
      />
    </div>
  )
}
