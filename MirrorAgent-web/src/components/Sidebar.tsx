import { useChatStore } from '../store/chatStore'
import { useAuthStore } from '../store/authStore'

export type View = 'home' | 'chat' | 'history' | 'stats' | 'review'

interface SidebarProps {
  view: View
  onNavigate: (view: View) => void
}

const NAV_ITEMS: { key: View; label: string }[] = [
  { key: 'home', label: '工作台' },
  { key: 'chat', label: '模拟面试' },
  { key: 'history', label: '历史会话' },
  { key: 'stats', label: '学习统计' },
  { key: 'review', label: '今日复习' },
]

export function Sidebar({ view, onNavigate }: SidebarProps) {
  const { newConversation, connected, resetForLogout } = useChatStore()
  const username = useAuthStore((s) => s.username)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold">MirrorAgent</h1>
        <p className="text-xs text-gray-400 mt-1">越练越懂你的 AI 面试教练</p>
      </div>

      <div className="p-3">
        <button
          onClick={() => {
            newConversation()
            onNavigate('chat')
          }}
          className="w-full py-2 px-4 border border-brand-400/60 rounded-lg text-sm text-brand-100 hover:border-brand-300 hover:bg-brand-500/20 transition"
        >
          + 新建对话
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full text-left py-2 px-3 rounded-lg text-sm transition ${
              view === item.key ? 'bg-brand-600 text-white shadow-md' : 'text-gray-300 hover:bg-white/10'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700 space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-gray-400">{connected ? '已连接' : '未连接'}</span>
        </div>
        {username && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300">{username}</span>
            <button onClick={() => { resetForLogout(); logout() }} className="text-gray-500 hover:text-red-400 transition">
              退出
            </button>
          </div>
        )}
      </div>
    </div>
  )
}