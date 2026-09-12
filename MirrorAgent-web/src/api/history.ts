export interface HistoryItem {
  sessionId: string
  position: string
  overallScore: number
  createdAt: string
}

export interface QuestionReview {
  questionContent?: string
  userAnswer?: string
  score?: number
  comment?: string
  keyPointsHit?: string[]
  keyPointsMissed?: string[]
}

export interface HistoryDetail extends HistoryItem {
  report: string
  reviewPlan: string
  questions?: QuestionReview[]
}

async function request<T>(token: string, path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error((body as { error?: string }).error || `请求失败 (${res.status})`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export async function fetchHistory(token: string): Promise<HistoryItem[]> {
  const data = await request<{ items: HistoryItem[] }>(token, '/api/history')
  return data.items ?? []
}

export async function fetchHistoryDetail(token: string, sessionId: string): Promise<HistoryDetail> {
  return request<HistoryDetail>(token, `/api/history/${encodeURIComponent(sessionId)}`)
}

export interface RecordReview {
  sessionId: string
  position: string
  createdAt: string
  questions?: QuestionReview[]
}

export async function fetchQuestionReviews(token: string): Promise<RecordReview[]> {
  const data = await request<{ items: RecordReview[] }>(token, '/api/history/question-reviews')
  return data.items ?? []
}