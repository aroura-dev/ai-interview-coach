import type { ChatMessage } from '../types/message'

export interface LocalSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const MAX_SESSIONS = 30
const keyFor = (user: string) => `mirror_chat_sessions_${user}`

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function loadSessions(user: string): LocalSession[] {
  try {
    const raw = localStorage.getItem(keyFor(user))
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? (arr as LocalSession[]) : []
  } catch {
    return []
  }
}

export function saveSessions(user: string, sessions: LocalSession[]): void {
  try {
    localStorage.setItem(keyFor(user), JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch {
    /* localStorage 满时静默忽略 */
  }
}

export function deleteSession(user: string, id: string): void {
  saveSessions(user, loadSessions(user).filter((s) => s.id !== id))
}

export function deriveTitle(messages: ChatMessage[]): string {
  const text = messages.find((m) => m.role === 'user' && m.messageType === 'text')
  if (text) {
    const t = text.content.trim().replace(/\s+/g, ' ')
    return t.length > 24 ? `${t.slice(0, 24)}…` : t
  }
  if (messages.some((m) => m.role === 'user' && m.messageType === 'file')) return '文件对话'
  return '新对话'
}