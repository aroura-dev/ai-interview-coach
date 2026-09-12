export interface ReviewItem {
  id: number
  userId: string
  topic: string
  ease: number
  intervalDays: number
  reps: number
  dueDate: string
  lastQuality: number
  status: string
  updatedAt?: string | null
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error((body as { error?: string }).error || `请求失败 (${res.status})`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export function fetchToday(token: string): Promise<ReviewItem[]> {
  return request<{ items: ReviewItem[] }>(token, '/api/review/today').then((d) => d.items ?? [])
}

export function fetchAllItems(token: string): Promise<ReviewItem[]> {
  return request<{ items: ReviewItem[] }>(token, '/api/review/items').then((d) => d.items ?? [])
}

export function gradeItem(token: string, topic: string, quality: number): Promise<ReviewItem> {
  return request<ReviewItem>(token, '/api/review/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, quality }),
  })
}

export function importReview(token: string, content: string): Promise<{ imported: boolean; topic: string }> {
  return request<{ imported: boolean; topic: string }>(token, '/api/review/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}