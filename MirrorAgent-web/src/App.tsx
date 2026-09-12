import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import type { View } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { HistoryPage } from './components/HistoryPage'
import { StatsPage } from './components/StatsPage'
import { ReviewPage } from './components/ReviewPage'
import { LoginPage } from './components/LoginPage'
import { HomePage } from './components/HomePage'
import { useWebSocket } from './hooks/useWebSocket'
import { fetchProfileSummary } from './api/profile'
import { useAuthStore } from './store/authStore'
import { useChatStore } from './store/chatStore'

export default function App() {
  const token = useAuthStore((s) => s.token)
  const username = useAuthStore((s) => s.username)
  const logout = useAuthStore((s) => s.logout)
  const wsRef = useWebSocket()
  const initChat = useChatStore((s) => s.initForUser)
  const [view, setView] = useState<View>('home')

  // 登录后加载该用户的最近一次本地对话
  useEffect(() => {
    if (token && username) initChat(username)
  }, [token, username, initChat])

  // 校验本地 token 是否仍有效；过期则自动登出回登录页
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetchProfileSummary(token).catch((e) => {
      const err = e as Error & { status?: number }
      if (!cancelled && err.status === 401) logout()
    })
    return () => { cancelled = true }
  }, [token, logout])

  if (!token) {
    return <LoginPage />
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar view={view} onNavigate={setView} />
      {view === 'home' ? (
        <HomePage username={username ?? ''} onNavigate={setView} />
      ) : view === 'history' ? (
        <HistoryPage onOpenChat={() => setView('chat')} />
      ) : view === 'stats' ? (
        <StatsPage onNavigate={setView} />
      ) : view === 'review' ? (
        <ReviewPage onNavigate={setView} />
      ) : (
        <ChatWindow wsRef={wsRef} />
      )}
    </div>
  )
}