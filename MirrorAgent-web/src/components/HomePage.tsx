import { useEffect, useState } from 'react'
import type { View } from './Sidebar'
import { useChatStore, listLocalSessions } from '../store/chatStore'
import { ConfirmDialog } from './ConfirmDialog'

import type { LocalSession } from '../store/chatHistory'

interface HomePageProps {
  username: string
  onNavigate: (view: View) => void
}

const LOOP: { key: View; title: string; desc: string }[] = [
  { key: 'chat', title: '模拟面试', desc: '传 JD + 简历，AI 按三阶段追问、逐题评分' },
  { key: 'history', title: '历史会话', desc: '回看每次面试的报告与复习计划' },
  { key: 'stats', title: '学习统计', desc: '平均分 / 进步曲线 / 薄弱点趋势' },
  { key: 'review', title: '今日复习', desc: 'SM-2 间隔复习，错题自动排队' },
]

function ModuleIcon({ kind }: { kind: string }) {
  const common = {
    className: 'h-6 w-6 text-brand-600',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (kind) {
    case 'history':
      return (
        <svg {...common}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    case 'stats':
      return (
        <svg {...common}>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      )
    case 'review':
      return (
        <svg {...common}>
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      )
    case 'chat':
    default:
      return (
        <svg {...common}>
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      )
  }
}

export function HomePage({ username, onNavigate }: HomePageProps) {
  const openSession = useChatStore((s) => s.openSession)
  const removeSession = useChatStore((s) => s.removeSession)
  const [sessions, setSessions] = useState<LocalSession[]>([])
  const [toDelete, setToDelete] = useState<LocalSession | null>(null)

  useEffect(() => {
    // 从 localStorage 同步外部状态，放入异步任务避免同步 effect 级联渲染。
    const timer = window.setTimeout(() => {
      setSessions(username ? listLocalSessions(username) : [])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [username])

  const fmtTime = (t: number) =>
    new Date(t).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    })

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{username || '同学'}，来一场模拟面试吧</h1>
          <p className="mt-1 text-sm text-gray-500">
            围绕真实 JD 与简历进行仿真面试，逐题评分并记录薄弱点，让每次练习都看得见进步。
          </p>
        </div>

        {/* 主 CTA */}
        <button
          onClick={() => onNavigate('chat')}
          className="group w-full rounded-2xl bg-linear-to-r from-brand-600 to-indigo-600 p-6 text-left text-white shadow-lg transition hover:shadow-xl hover:brightness-105"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">开始仿真面试</p>
              <p className="mt-1 text-sm text-brand-100">
                上传意向 JD 与简历，按基础、项目、系统设计三阶段追问，每题实时评分
              </p>
            </div>
            <svg
              className="h-7 w-7 shrink-0 text-white/80 transition group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </button>

        <p className="mb-3 mt-8 text-sm font-semibold text-gray-700">备战流程</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LOOP.map((m) => (
            <button
              key={m.key}
              onClick={() => onNavigate(m.key)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  <ModuleIcon kind={m.key} />
                </span>
                <div>
                  <p className="font-medium text-gray-900">{m.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{m.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 最近对话 */}
        {sessions.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">最近对话</p>
              <button
                onClick={() => onNavigate('history')}
                className="text-xs text-gray-400 transition hover:text-gray-600"
              >
                查看全部 →
              </button>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    openSession(s.id)
                    onNavigate('chat')
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md"
                >

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{s.title}</span>
                    <span className="mt-0.5 flex items-center gap-3 text-xs">
                      <span className="text-gray-400">{fmtTime(s.updatedAt)}</span>
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

        {/* 提示 */}
        <div className="mt-8 flex items-center gap-2 rounded-lg border border-brand-200/70 bg-brand-50/70 px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
          </svg>
          <span className="shrink-0 text-xs font-semibold text-brand-700">小贴士</span>
          <span className="min-w-0 text-xs leading-5 text-gray-600">先上传自定义题库，再开始面试；每场面试结束会自动生成报告与复习计划，并沉淀到长期能力画像，越练越懂你。</span>
        </div>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        title="删除对话记录？"
        desc={toDelete ? `${toDelete.title} 的聊天记录将被删除，删除后无法恢复。` : undefined}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            removeSession(toDelete.id)
            setSessions(listLocalSessions(username))
          }
          setToDelete(null)
        }}
      />
    </div>
  )
}
