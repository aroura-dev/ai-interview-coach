import { create } from 'zustand'
import type { ChatMessage, ServerMessage } from '../types/message'
import {
  loadSessions,
  saveSessions,
  deleteSession,
  uid,
  deriveTitle,
  type LocalSession,
} from './chatHistory'

interface ChatState {
  messages: ChatMessage[]
  connected: boolean
  isInterviewing: boolean
  currentStage: string
  /** 是否正在等待 AI 回复（用于显示输入中提示） */
  pendingReply: boolean
  /** 当前登录用户（用于本地会话存取） */
  user: string | null
  currentSessionId: string | null
  pendingPractice: string | null

  addMessage: (msg: ChatMessage) => void
  setConnected: (v: boolean) => void
  setInterviewing: (v: boolean) => void
  setPendingReply: (v: boolean) => void
  queuePractice: (topic: string) => void
  clearPractice: () => void
  handleServerMessage: (msg: ServerMessage) => void
  appendToken: (content: string) => void
  finishStream: () => void
  /** 登录后加载该用户的最近一次对话 */
  initForUser: (user: string) => void
  /** 新建一段对话（保留旧会话到本地） */
  newConversation: () => void
  /** 打开某段历史对话 */
  openSession: (id: string) => void
  removeSession: (id: string) => void
  /** 登出时清理内存状态 */
  resetForLogout: () => void
  clearMessages: () => void
}

const nextId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

function syncCurrent(user: string | null, sessionId: string | null, messages: ChatMessage[]) {
  if (!user || !sessionId || messages.length === 0) return
  const sessions = loadSessions(user)
  const now = Date.now()
  const idx = sessions.findIndex((s) => s.id === sessionId)
  const title = deriveTitle(messages)
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], messages, title, updatedAt: now }
  } else {
    sessions.unshift({ id: sessionId, title, createdAt: now, updatedAt: now, messages })
  }
  saveSessions(user, sessions)
}

export function listLocalSessions(user: string): LocalSession[] {
  return loadSessions(user).filter((s) => s.messages.length > 0)
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  connected: false,
  isInterviewing: false,
  currentStage: '',
  pendingReply: false,
  user: null,
  currentSessionId: null,
  pendingPractice: null,

  addMessage: (msg) => {
    set((s) => ({ messages: [...s.messages, msg] }))
    syncCurrent(get().user, get().currentSessionId, get().messages)
  },

  setConnected: (connected) => set({ connected }),

  setInterviewing: (v) => set({ isInterviewing: v }),

  setPendingReply: (v) => set({ pendingReply: v }),

  queuePractice: (topic) => set({ pendingPractice: topic }),
  clearPractice: () => set({ pendingPractice: null }),

  handleServerMessage: (msg) => {
    set({ pendingReply: false })
    const now = Date.now()
    switch (msg.type) {
      case 'chat_reply':
        get().addMessage({
          id: nextId(), role: 'assistant', content: msg.content,
          messageType: 'text', timestamp: now,
        })
        break

      case 'stage_change':
        set({ currentStage: msg.stage })
        get().addMessage({
          id: nextId(), role: 'system', content: msg.message,
          messageType: 'stage', stage: msg.stage, timestamp: now,
        })
        break

      case 'question':
        get().addMessage({
          id: nextId(), role: 'assistant', content: msg.content,
          messageType: 'question', questionNum: msg.question_num, timestamp: now,
        })
        break

      case 'score':
        get().addMessage({
          id: nextId(), role: 'system', content: msg.feedback,
          messageType: 'score', score: msg.score, feedback: msg.feedback,
          keyPointsHit: msg.key_points_hit, keyPointsMissed: msg.key_points_missed,
          timestamp: now,
        })
        break

      case 'report':
        get().addMessage({
          id: nextId(), role: 'assistant', content: msg.content,
          messageType: 'report', timestamp: now,
        })
        break

      case 'match_report':
        get().addMessage({
          id: nextId(), role: 'assistant', content: msg.content,
          messageType: 'match_report', timestamp: now,
        })
        break

      case 'review_plan':
        get().addMessage({
          id: nextId(), role: 'assistant', content: msg.content,
          messageType: 'review_plan', timestamp: now,
        })
        break

      case 'interview_complete':
        set({ isInterviewing: false, currentStage: '' })
        break

      case 'upload_result':
        get().addMessage({
          id: nextId(), role: 'system', content: msg.content,
          messageType: 'upload_result', timestamp: now,
          feedback: msg.message, // 校验失败详情
        })
        break

      case 'rag_evaluation':
        get().addMessage({
          id: nextId(), role: 'system', content: msg.rag_evaluation.summary,
          messageType: 'rag_evaluation', timestamp: now,
          ragEvaluation: msg.rag_evaluation,
        })
        break

      case 'token':
        get().appendToken(msg.content)
        break

      case 'stream_end':
        get().finishStream()
        break

      case 'error':
        get().addMessage({
          id: nextId(), role: 'system', content: msg.message,
          messageType: 'text', timestamp: now,
        })
        if (get().isInterviewing) {
          set({ isInterviewing: false, currentStage: '' })
        }
        break
    }
  },

  appendToken: (content) => {
    set((s) => {
      const msgs = s.messages
      const last = msgs[msgs.length - 1]
      if (last && last.role === 'assistant' && last.messageType === 'text' && last.streaming) {
        const updated = [...msgs]
        updated[updated.length - 1] = { ...last, content: last.content + content }
        return { messages: updated }
      }
      return {
        messages: [
          ...msgs,
          { id: nextId(), role: 'assistant', content, messageType: 'text', streaming: true, timestamp: Date.now() },
        ],
      }
    })
  },

  finishStream: () => {
    set((s) => {
      const msgs = s.messages
      const last = msgs[msgs.length - 1]
      if (last && last.streaming) {
        const updated = [...msgs]
        updated[updated.length - 1] = { ...last, streaming: false }
        return { messages: updated }
      }
      return {}
    })
    syncCurrent(get().user, get().currentSessionId, get().messages)
  },

  initForUser: (user) => {
    if (get().user === user) return
    const sessions = loadSessions(user)
    const last = sessions.find((s) => s.messages.length > 0) ?? null
    set({
      user,
      messages: last ? last.messages : [],
      currentSessionId: last ? last.id : uid(),
      isInterviewing: false,
      currentStage: '',
      pendingReply: false,
    })
  },

  newConversation: () => {
    const { user, currentSessionId, messages } = get()
    syncCurrent(user, currentSessionId, messages)
    set({
      currentSessionId: uid(),
      messages: [],
      isInterviewing: false,
      currentStage: '',
      pendingReply: false,
    })
  },

  openSession: (id) => {
    const sessions = loadSessions(get().user ?? '')
    const s = sessions.find((x) => x.id === id)
    if (!s) return
    set({
      currentSessionId: id,
      messages: s.messages,
      isInterviewing: false,
      currentStage: '',
      pendingReply: false,
    })
  },

  removeSession: (id) => {
    const { user, currentSessionId } = get()
    if (!user) return
    deleteSession(user, id)
    if (currentSessionId === id) {
      // 删除当前会话后：不切换到其它历史，直接开启一段新对话
      set({
        currentSessionId: uid(),
        messages: [],
        isInterviewing: false,
        currentStage: '',
        pendingReply: false,
      })
    }
  },

  resetForLogout: () => {
    set({
      user: null,
      currentSessionId: null,
  pendingPractice: null,
      messages: [],
      isInterviewing: false,
      currentStage: '',
      pendingReply: false,
    })
  },

  clearMessages: () => get().newConversation(),
}))