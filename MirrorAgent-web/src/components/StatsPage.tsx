import { useCallback, useEffect, useState } from 'react'
import { fetchProfileSummary } from '../api/profile'
import type { ProfileSummary } from '../api/profile'
import type { HistoryItem } from '../api/history'
import { fetchToday } from '../api/review'
import { fetchQuestionReviews, type RecordReview, type QuestionReview } from '../api/history'
import { useAuthStore } from '../store/authStore'

function fmtTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

/** 清洗主题文本里的 HTML 实体与换行标签 */
function cleanTopic(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&#x20;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x2F;/gi, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

function barColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="flex min-h-[96px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 text-center">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone ?? 'text-gray-800'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  )
}

function ScoreTrend({ series }: { series: HistoryItem[] }) {
  const pts = [...series].reverse()
  if (pts.length === 0) return null
  const W = 600
  const H = 190
  const P = 30
  const n = pts.length
  const scores = pts.map((p) => p.overallScore)
  let lo = Math.min(...scores)
  let hi = Math.max(...scores)
  if (hi - lo < 20) {
    const mid = (hi + lo) / 2
    lo = Math.max(0, mid - 10)
    hi = Math.min(100, mid + 10)
  }
  const pad = Math.max(3, (hi - lo) * 0.18)
  lo = Math.max(0, lo - pad)
  hi = Math.min(100, hi + pad)
  if (hi <= lo) hi = Math.min(100, lo + 10)
  const scoreHex = (v: number) => (v >= 70 ? '#22c55e' : v >= 50 ? '#eab308' : '#ef4444')
  const x = (i: number) => (n === 1 ? W / 2 : P + (i * (W - 2 * P)) / (n - 1))
  const y = (s: number) => H - P - ((Math.min(hi, Math.max(lo, s)) - lo) / (hi - lo)) * (H - 2 * P)
  const coords = pts.map((p, i) => ({ x: x(i), y: y(p.overallScore) }))
  const path = (() => {
    if (coords.length < 3) {
      return coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
    }
    let d = `M${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] ?? coords[i]
      const p1 = coords[i]
      const p2 = coords[i + 1]
      const p3 = coords[i + 2] ?? p2
      const c1x = p1.x + (p2.x - p0.x) / 6
      const c1y = p1.y + (p2.y - p0.y) / 6
      const c2x = p2.x - (p3.x - p1.x) / 6
      const c2y = p2.y - (p3.y - p1.y) / 6
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
    }
    return d
  })()
  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${(H - P).toFixed(1)} L${coords[0].x.toFixed(1)},${(H - P).toFixed(1)} Z`
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const gridVals = [lo, (lo + hi) / 2, hi]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full">
      {gridVals.map((g, i) => (
        <g key={i}>
          <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#e5e7eb" strokeDasharray="3 4" strokeWidth="1" />
          <text x={4} y={y(g) + 4} fontSize="10" fill="#9ca3af">
            {Math.round(g)}
          </text>
        </g>
      ))}
      {n > 1 && (
        <line x1={P} x2={W - P} y1={y(avg)} y2={y(avg)} stroke="#93c5fd" strokeDasharray="5 4" strokeWidth="1" />
      )}
      <path d={area} fill="#dbeafe" opacity="0.45" />
      <path d={path} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={pts[i].sessionId + i}>
          <circle cx={c.x} cy={c.y} r="4.5" fill="#fff" stroke={scoreHex(pts[i].overallScore)} strokeWidth="2.5" />
          {n <= 10 && (
            <text x={c.x} y={c.y - 11} fontSize="11" textAnchor="middle" fill="#374151">
              {pts[i].overallScore}
            </text>
          )}
        </g>
      ))}
      {(n <= 10 ? coords : [coords[0], coords[n - 1]]).map((c, i) => (
        <text key={`x${i}`} x={c.x} y={H - 8} fontSize="10" textAnchor="middle" fill="#9ca3af">
          {fmtDay(pts[n <= 10 ? i : i === 0 ? 0 : n - 1].createdAt)}
        </text>
      ))}
    </svg>
  )
}

interface RadarAxis { label: string; full?: string; value: number }
function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const W = 340
  const H = 260
  const cx = W / 2
  const cy = H / 2 + 2
  const R = 76
  const n = axes.length
  if (n < 3) return null
  const pt = (i: number, v: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const r = (Math.min(100, Math.max(5, v)) / 100) * R
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }
  const grid = [25, 50, 75, 100].map((gv) => {
    const g = (i: number) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
      const r = (gv / 100) * R
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
    }
    return Array.from({ length: n }, (_, i) => g(i)).join(' ')
  })
  const poly = axes.map((a, i) => pt(i, a.value)).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-56 w-auto">
      {grid.map((g, gi) => (
        <polygon key={gi} points={g} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {axes.map((a, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
        return (
          <line key={a.label} x1={cx} y1={cy} x2={cx + R * Math.cos(angle)} y2={cy + R * Math.sin(angle)} stroke="#e5e7eb" strokeWidth="1" />
        )
      })}
      <polygon points={poly} fill="#2563eb" opacity="0.18" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      {axes.map((a, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n
        const lx = cx + (R + 28) * Math.cos(angle)
        const ly = cy + (R + 20) * Math.sin(angle)
        const wrap = (s: string, size = 7) => {
          if (s.length <= size) return [s]
          const out: string[] = []
          for (let k = 0; k < s.length; k += size) out.push(s.slice(k, k + size))
          return out
        }
        const lines = wrap(a.label)
        const px = cx + (Math.min(100, Math.max(5, a.value)) / 100) * R * Math.cos(angle)
        const py = cy + (Math.min(100, Math.max(5, a.value)) / 100) * R * Math.sin(angle)
        return (
          <g key={a.label}>
            <title>{a.full ?? a.label}</title>
            <circle cx={px} cy={py} r="3" fill="#2563eb" />
            <text x={lx} y={ly - (lines.length - 1) * 6} fontSize="10.5" textAnchor="middle" fill="#374151">
              {lines.map((ln, li) => (
                <tspan key={li} x={lx} dy={li === 0 ? 0 : 12}>
                  {ln}
                </tspan>
              ))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
export function StatsPage({ onNavigate }: { onNavigate?: (view: 'review') => void }) {
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const [data, setData] = useState<ProfileSummary | null>(null)
  const [error, setError] = useState('')
  const [todayCount, setTodayCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [reviews, setReviews] = useState<RecordReview[]>([])

  const load = useCallback(async () => {
    if (!token) return
    setError('')
    try {
      setData(await fetchProfileSummary(token))
      try {
        setTodayCount((await fetchToday(token)).length)
      } catch { /* 复习数量加载失败不影响主统计 */ }
      try {
        setReviews(await fetchQuestionReviews(token))
      } catch { /* 逐题汇总失败不影响主统计 */ }
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

  const snapshots = data?.snapshots ?? []
  const maxWeak = snapshots.reduce((m, s) => Math.max(m, s.weakPointCount), 1)
  const topicMap = new Map<string, { date: string; score: number }[]>()
  for (const sn of snapshots) {
    let ws: { topic: string; score: number }[]
    try {
      ws = sn.weakPointsJson ? (JSON.parse(sn.weakPointsJson) as { topic: string; score: number }[]) : []
    } catch {
      ws = []
    }
    for (const item of ws) {
      if (!item || typeof item.topic !== 'string') continue
      const topic = cleanTopic(item.topic)
      const arr = topicMap.get(topic) ?? []
      arr.push({ date: sn.createdAt, score: Number(item.score) || 0 })
      topicMap.set(topic, arr)
    }
  }
  const topicTrendRows = Array.from(topicMap.entries())
    .filter(([, pts]) => pts.length >= 2)
    .map(([topic, pts]) => {
      const first = pts[0].score
      const last = pts[pts.length - 1].score
      return { topic, first, last, delta: last - first, points: pts.length }
    })
    .sort((a, b) => a.last - b.last)

  const weakDelta = snapshots.length >= 2
    ? snapshots[snapshots.length - 1].weakPointCount - snapshots[0].weakPointCount
    : 0

  const radarAxes = data?.weakPoints
    ? data.weakPoints.slice(0, 6).map((wp) => {
        const full = cleanTopic(wp.topic)
        return {
          label: full.length > 14 ? full.slice(0, 14) : full,
          full,
          value: Math.round(Math.min(100, Math.max(0, 100 - wp.score))),
        }
      })
    : []

  const handleExport = () => {
    if (!data) return
    const payload = { exportedAt: new Date().toISOString(), summary: data }
    download(`学习统计-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  const allQ: (QuestionReview & { pos: string })[] = reviews.flatMap((r) =>
    (r.questions ?? []).map((q) => ({ ...q, pos: r.position ?? '' })),
  )
  const missCount = new Map<string, number>()
  const contentCount = new Map<string, { n: number; sum: number }>()
  for (const q of allQ) {
    for (const k of q.keyPointsMissed ?? []) missCount.set(k, (missCount.get(k) ?? 0) + 1)
    if (q.questionContent) {
      const c0 = contentCount.get(q.questionContent) ?? { n: 0, sum: 0 }
      c0.n += 1
      c0.sum += q.score ?? 0
      contentCount.set(q.questionContent, c0)
    }
  }
  const missTop = Array.from(missCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxMiss = missTop.reduce((m, [, v]) => Math.max(m, v), 1)
  const qTop = Array.from(contentCount.entries())
    .map(([content, c]) => ({ content, n: c.n, avg: Math.round(c.sum / c.n) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
  const lowCount = allQ.filter((q) => (q.score ?? 100) < 60).length
  const hitTotal = allQ.reduce((s, q) => s + (q.keyPointsHit?.length ?? 0), 0)
  const missTotal = allQ.reduce((s, q) => s + (q.keyPointsMissed?.length ?? 0), 0)

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto py-6 px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">学习统计</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={!data}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              导出
            </button>
            <button
              onClick={async () => {
                setRefreshing(true)
                await load()
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
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {!data && !error && <p className="text-sm text-gray-400">加载中...</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <Card label="面试次数" value={String(data.interviewCount)} />
              <Card label="平均分" value={data.interviewCount > 0 ? String(data.avgScore) : '—'} />
              <Card label="最高分" value={data.interviewCount > 0 ? String(data.bestScore) : '—'} />
              <Card
                label="进步"
                value={data.interviewCount > 1 ? `${data.scoreDelta > 0 ? '+' : ''}${data.scoreDelta}` : '—'}
                sub={data.interviewCount > 1 ? '最近一次 vs 最早一次' : undefined}
              />
            </div>

            {todayCount > 0 && (
              <button
                onClick={() => onNavigate?.('review')}
                className="mb-5 flex w-full items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-left transition hover:border-brand-300"
              >
                <div>
                  <p className="text-sm font-medium text-brand-800">今日待复习 {todayCount} 项</p>
                  <p className="mt-0.5 text-xs text-gray-500">按 SM-2 排期，现在复习记忆效果最好</p>
                </div>
                <span className="shrink-0 text-sm text-brand-600">去复习 →</span>
              </button>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">历次面试得分</h3>
              {data.series.length === 0 ? (
                <p className="text-sm text-gray-400">暂无面试记录，先完成一场模拟面试吧</p>
              ) : (
                <div>
                  <ScoreTrend series={data.series} />
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {data.series.map((it) => (
                      <div key={it.sessionId} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-gray-700">{it.position || '未命名岗位'}</span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
                          {fmtTime(it.createdAt)}
                          <b className={`text-sm ${scoreColor(it.overallScore)}`}>{it.overallScore}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">薄弱点数量趋势</h3>
              <p className="text-xs text-gray-400 mb-3">每场面试结束后记录一次画像快照</p>
              {snapshots.length === 0 ? (
                <p className="text-sm text-gray-400">完成一场面试后这里会出现趋势</p>
              ) : (
                <>
                  <div className="flex items-end gap-3 h-32">
                    {snapshots.map((sn, i) => {
                      const h = Math.max(10, Math.round((sn.weakPointCount / maxWeak) * 100))
                      return (
                        <div key={`${sn.sessionId}-${i}`} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <span className={`text-sm font-bold ${sn.weakPointCount <= 2 ? 'text-green-600' : sn.weakPointCount <= 4 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {sn.weakPointCount}
                          </span>
                          <div
                            className={`w-7 rounded-t ${sn.weakPointCount <= 2 ? 'bg-green-400' : sn.weakPointCount <= 4 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ height: `${h}%` }}
                          />
                          <span className="text-[10px] text-gray-400">{fmtDay(sn.createdAt)}</span>
                        </div>
                      )
                    })}
                  </div>
                  {snapshots.length >= 2 && (
                    <p className="mt-3 text-xs text-gray-500">
                      从 <b>{snapshots[0].weakPointCount}</b> 个降至{' '}
                      <b className={weakDelta < 0 ? 'text-green-600' : 'text-red-600'}>
                        {snapshots[snapshots.length - 1].weakPointCount}
                      </b>{' '}
                      个（{weakDelta < 0 ? `减少 ${-weakDelta}` : weakDelta > 0 ? `增加 ${weakDelta}` : '持平'}）
                    </p>
                  )}
                </>
              )}
            
                    {topicTrendRows.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                        <p className="text-xs text-gray-400">薄弱主题变化（首次 → 最近）</p>
                        {topicTrendRows.map((row) => (
                          <div key={row.topic} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700 truncate">{row.topic}</span>
                            <span className="flex items-center gap-2 shrink-0 text-xs">
                              <span className="text-gray-400">{row.first} → </span>
                              <b className={row.last >= 70 ? 'text-green-600' : row.last >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                                {row.last}
                              </b>
                              <span className={row.delta < 0 ? 'text-green-600' : row.delta > 0 ? 'text-red-600' : 'text-gray-400'}>
                                {row.delta === 0 ? '持平' : row.delta < 0 ? `↓ ${-row.delta}` : `↑ ${row.delta}`}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

</div>

            {radarAxes.length >= 3 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">能力雷达</h3>
                <p className="text-xs text-gray-400 mb-2">按薄弱点得分反推能力（分越高代表越强）</p>
                <RadarChart axes={radarAxes} />
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">逐题复盘统计</h3>
              <p className="text-xs text-gray-400 mb-3">汇总所有面试的每题得分与要点</p>
              {allQ.length === 0 ? (
                <p className="text-sm text-gray-400">完成几场面试后，这里会按题目汇总常错点</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">累计答题</div>
                      <div className="mt-0.5 text-xl font-bold text-gray-800">{allQ.length}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">低分题（&lt;60）</div>
                      <div className="mt-0.5 text-xl font-bold text-red-600">{lowCount}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">命中要点</div>
                      <div className="mt-0.5 text-xl font-bold text-green-600">{hitTotal}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">遗漏要点</div>
                      <div className="mt-0.5 text-xl font-bold text-amber-600">{missTotal}</div>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium text-gray-500">常错漏点 TOP</p>
                      {missTop.length === 0 ? (
                        <p className="text-sm text-gray-400">暂无遗漏要点</p>
                      ) : (
                        <div className="space-y-2">
                          {missTop.map(([label, cnt]) => (
                            <div key={label}>
                              <div className="mb-0.5 flex items-center justify-between gap-2 text-sm">
                                <span className="min-w-0 truncate text-gray-700">{label}</span>
                                <span className="shrink-0 text-xs text-gray-400">{cnt} 次</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-red-400"
                                  style={{ width: `${(cnt / maxMiss) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-gray-500">常错题目 TOP</p>
                      {qTop.length === 0 ? (
                        <p className="text-sm text-gray-400">暂无重复错题</p>
                      ) : (
                        <div className="space-y-2">
                          {qTop.map((it) => (
                            <div key={it.content} className="rounded-lg border border-gray-100 px-3 py-2">
                              <div className="text-sm text-gray-700">{it.content.length > 46 ? `${it.content.slice(0, 46)}…` : it.content}</div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                出现 {it.n} 次
                                <span className={scoreColor(it.avg)}>均分 {it.avg}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">当前薄弱点</h3>
                {data.weakPoints.length === 0 ? (
                  <p className="text-sm text-gray-400">暂无薄弱点，继续保持</p>
                ) : (
                  <div className="space-y-2">
                    {data.weakPoints.map((wp) => (
                      <div key={wp.topic} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-gray-700">{cleanTopic(wp.topic)}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            {(wp.wrongCount ?? 0) > 0 && (
                              <span className="text-xs text-gray-400">答错 {wp.wrongCount} 次</span>
                            )}
                            <b className={scoreColor(wp.score)}>{wp.score}</b>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full ${barColor(wp.score)}`}
                            style={{ width: `${Math.min(100, Math.max(0, wp.score))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">技能水平</h3>
                {Object.keys(data.skillLevel).length === 0 ? (
                  <p className="text-sm text-gray-400">暂无技能画像数据</p>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const groups = [
                        { key: 'advanced', label: '精通', cls: 'border-green-200 bg-green-50 text-green-700' },
                        { key: 'intermediate', label: '熟悉', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
                        { key: 'beginner', label: '了解', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
                      ]
                      const entries = Object.entries(data.skillLevel)
                      return groups.map((g) => {
                        const list = entries.filter(([, v]) => v === g.key)
                        if (list.length === 0) return null
                        return (
                          <div key={g.key}>
                            <p className="mb-1.5 text-xs font-medium text-gray-500">
                              {g.label}（{list.length}）
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {list.map(([skill]) => (
                                <span
                                  key={skill}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${g.cls}`}
                                >
                                  <span className="font-medium text-gray-700">{cleanTopic(skill)}</span>
                                  <span className="font-semibold">{g.label}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
