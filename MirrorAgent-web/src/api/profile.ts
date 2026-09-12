import type { HistoryItem } from './history'

export interface WeakPointItem {
  topic: string
  score: number
  hitCount?: number
  wrongCount?: number
  lastSeen?: string
}

export interface ProfileSnapshot {
  sessionId: string
  weakPointCount: number
  avgWeakScore: number
  weakPointsJson?: string | null
  createdAt: string
}

export interface ProfileSummary {
  interviewCount: number
  avgScore: number
  bestScore: number
  latestScore: number
  scoreDelta: number
  latestPosition?: string | null
  latestAt?: string | null
  series: HistoryItem[]
  weakPoints: WeakPointItem[]
  skillLevel: Record<string, string>
  snapshots: ProfileSnapshot[]
}

export async function fetchProfileSummary(token: string): Promise<ProfileSummary> {
  const res = await fetch('/api/profile/summary', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error((body as { error?: string }).error || `请求失败 (${res.status})`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<ProfileSummary>
}