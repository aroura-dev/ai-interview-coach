import { useEffect, useRef, useState } from 'react'
import { MessageBubble } from './MessageBubble'
import { FileUpload } from './FileUpload'
import { StageIndicator } from './StageIndicator'
import { useChatStore } from '../store/chatStore'
import type { WSClient } from '../api/ws'
import type { ClientMessage } from '../types/message'

function FileBadge({ name }: { name: string }) {
  const ext = (name.split('.').pop() ?? '').toLowerCase()
  let color = 'text-gray-400'
  let glyph = (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </>
  )
  if (ext === 'pdf') {
    color = 'text-red-500'
    glyph = (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>
    )
  } else if (ext === 'doc' || ext === 'docx') {
    color = 'text-blue-500'
    glyph = (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
        <circle cx="9" cy="20" r="0.5" />
      </>
    )
  } else if (ext === 'md') {
    color = 'text-violet-500'
    glyph = (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <polyline points="10 12 8 14.5 10 17" />
        <polyline points="14 12 16 14.5 14 17" />
      </>
    )
  } else if (ext === 'txt') {
    color = 'text-gray-500'
    glyph = (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
      </>
    )
  } else if (ext === 'xls' || ext === 'xlsx') {
    color = 'text-green-500'
    glyph = (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
        <line x1="12" y1="13" x2="12" y2="17" />
      </>
    )
  }
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${color}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}
interface ChatWindowProps {
  wsRef: React.RefObject<WSClient | null>
}

export function ChatWindow({ wsRef }: ChatWindowProps) {
  const { messages, isInterviewing, pendingReply } = useChatStore()
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; data: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showInterviewSetup, setShowInterviewSetup] = useState(false)
  const [jdText, setJdText] = useState('')
  const [resumeText, setResumeText] = useState('')
  const [jdFile, setJdFile] = useState<{ name: string; data: string } | null>(null)
  const [resumeFile, setResumeFile] = useState<{ name: string; data: string } | null>(null)
  const questionFileRef = useRef<HTMLInputElement>(null)
  const [uploadingQuestions, setUploadingQuestions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送后等待回复：自动滚到输入指示
  useEffect(() => {
    if (pendingReply) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [pendingReply])

  const send = (msg: ClientMessage) => {
    wsRef.current?.send(msg)
  }

  const pendingPractice = useChatStore((s) => s.pendingPractice)
  const clearPractice = useChatStore((s) => s.clearPractice)

  // 来自「今日复习」的练同类题请求：连接就绪后自动发一条出题消息
  useEffect(() => {
    if (!pendingPractice) return
    let tries = 0
    const content = `来1道${pendingPractice}题`
    const timer = window.setInterval(() => {
      tries++
      if (wsRef.current?.isOpen()) {
        wsRef.current.send({ type: 'chat', content })
        useChatStore.getState().addMessage({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          content: `练一道「${pendingPractice}」同类题`,
          messageType: 'text',
          timestamp: Date.now(),
        })
        useChatStore.getState().setPendingReply(true)
        clearPractice()
        window.clearInterval(timer)
      } else if (tries >= 20) {
        window.clearInterval(timer)
        clearPractice()
      }
    }, 300)
    return () => window.clearInterval(timer)
  }, [pendingPractice, clearPractice, wsRef])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const read = (file: File) =>
      new Promise<{ name: string; data: string }>((resolve) => {
        const reader = new FileReader()
        reader.onload = () =>
          resolve({ name: file.name, data: (reader.result as string).split(',')[1] })
        reader.readAsDataURL(file)
      })
    Promise.all(files.map(read)).then((items) => {
      setAttachedFiles((prev) => [...prev, ...items])
    })
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = () => {
    const text = input.trim()
    const files = attachedFiles
    if (!text && files.length === 0) return

    if (isInterviewing) {
      send({ type: 'answer', content: text })
    } else if (files.length > 0) {
      // 带多条附件：连续 [FILE:文件名]base64 块，用户文本放末尾用 \n---\n 分隔
      const filePart = files.map((f) => `[FILE:${f.name}]${f.data}`).join('')
      const content = filePart + (text ? `\n---\n${text}` : '')
      send({ type: 'chat', content })
    } else {
      send({ type: 'chat', content: text })
    }

    // 文件与文字分开发送显示：先显示文件，再显示问题，避免混在一起
    const chatStore = useChatStore.getState()
    const mid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const now = Date.now()
    if (files.length > 0) {
      chatStore.addMessage({
        id: mid(),
        role: 'user',
        content: files.map((f) => f.name).join('\n'),
        messageType: 'file',
        timestamp: now,
      })
    }
    if (text) {
      chatStore.addMessage({
        id: mid(),
        role: 'user',
        content: text,
        messageType: 'text',
        timestamp: now,
      })
    }
    useChatStore.getState().setPendingReply(true)
    setInput('')
    setAttachedFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleUploadQuestions = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingQuestions(true)
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      send({ type: 'upload_questions', filename: file.name, data: base64 })
      useChatStore.getState().addMessage({
        id: String(Date.now()),
        role: 'user',
        content: `上传题库：${file.name}`,
        messageType: 'file',
        timestamp: Date.now(),
      })
      setUploadingQuestions(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleStartInterview = () => {
    const jd = jdFile ? `[FILE:${jdFile.name}]${jdFile.data}` : jdText
    const resume = resumeFile ? `[FILE:${resumeFile.name}]${resumeFile.data}` : resumeText
    if (!jd || !resume) return

    send({ type: 'start_interview', jd, resume })
    useChatStore.getState().setInterviewing(true)
    useChatStore.getState().addMessage({
      id: String(Date.now()),
      role: 'user',
      content: '开始面试',
      messageType: 'text',
      timestamp: Date.now(),
    })
    setShowInterviewSetup(false)
    setJdText('')
    setResumeText('')
    setJdFile(null)
    setResumeFile(null)
  }

  const handleMatchOnly = () => {
    const jd = jdFile ? `[FILE:${jdFile.name}]${jdFile.data}` : jdText
    const resume = resumeFile ? `[FILE:${resumeFile.name}]${resumeFile.data}` : resumeText
    if (!jd || !resume) return

    send({ type: 'match_check', jd, resume })
    useChatStore.getState().addMessage({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: '生成 JD × 简历 匹配自检报告',
      messageType: 'text',
      timestamp: Date.now(),
    })
    setShowInterviewSetup(false)
    setJdText('')
    setResumeText('')
    setJdFile(null)
    setResumeFile(null)
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      <StageIndicator />

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-gray-400">
            <p className="text-sm leading-6">
              可先上传自定义题库，再点击开始面试并填写意向 JD 与简历；
               <br />
              也可以直接输入问题，让 AI 讲解考点或即时出几道题。
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {/* 等待回复的输入中提示 */}
        {pendingReply && (
          <div className="flex justify-start mb-4">
            <div className="rounded-2xl bg-gray-100 px-4 py-3 text-gray-400">
              <div className="flex items-center gap-1">
                <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                <span className="typing-dot" style={{ animationDelay: '160ms' }} />
                <span className="typing-dot" style={{ animationDelay: '320ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 面试准备面板 */}
      {showInterviewSetup && (
        <div className="px-4 py-4 border-t bg-gray-50">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">JD（岗位描述）</label>
              <FileUpload
                label="拖拽上传 JD 文件（PDF/TXT/DOCX）或在下方粘贴"
                accept=".pdf,.txt,.docx,.md"
                onFileLoaded={(name, data) => setJdFile({ name, data })}
              />
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="或粘贴 JD 文本 / 招聘链接..."
                rows={4}
                className="mt-2 w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">简历</label>
              <FileUpload
                label="拖拽上传简历（PDF/DOCX）或在下方粘贴"
                accept=".pdf,.txt,.docx"
                onFileLoaded={(name, data) => setResumeFile({ name, data })}
              />
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="或粘贴简历文本..."
                rows={4}
                className="mt-2 w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowInterviewSetup(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleMatchOnly}
              disabled={(!jdText && !jdFile) || (!resumeText && !resumeFile)}
              className="px-4 py-2 text-sm rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              仅生成匹配报告
            </button>
            <button
              onClick={handleStartInterview}
              disabled={(!jdText && !jdFile) || (!resumeText && !resumeFile)}
              className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始面试
            </button>
          </div>
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t px-4 py-3">
        {/* 附件预览：支持多条 */}
        {attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachedFiles.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-2 py-1.5 text-sm"
              >
                <FileBadge name={f.name} />

                <span className="min-w-0 flex-1 break-all text-gray-700">{f.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-auto text-gray-400 transition hover:text-red-500"
                  aria-label="移除附件"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {!isInterviewing && (
            <>
              <input
                ref={questionFileRef}
                type="file"
                accept=".pdf,.txt,.md,.docx"
                className="hidden"
                onChange={handleUploadQuestions}
              />
              <div className="relative group">
                <button
                  onClick={() => questionFileRef.current?.click()}
                  disabled={uploadingQuestions}
                  className="px-3 py-2 text-sm border border-gray-300 bg-white text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
                >
                  {uploadingQuestions ? '解析中...' : '上传题库'}
                </button>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  <p className="font-medium mb-1">上传自定义面试题库</p>
                  <p>支持 PDF/TXT/MD 格式，系统自动解析入库。</p>
                  <p className="mt-1 text-gray-300">• 不同文件名 → 追加到知识库</p>
                  <p className="text-gray-300">• 同文件名重传 → 自动更新该题库</p>
                  <p className="text-gray-300">• 相同文件内容 → 自动跳过</p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                </div>
              </div>
              <button
                onClick={() => setShowInterviewSetup(!showInterviewSetup)}
                className="px-3 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 whitespace-nowrap"
              >
                开始面试
              </button>
            </>
          )}
          {isInterviewing && (
            <button
              onClick={() => send({ type: 'quit_interview' })}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
            >
              终止面试
            </button>
          )}
          {/* 文件上传按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx,.md"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            title="上传文件"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInterviewing ? '输入你的回答...' : '输入消息、粘贴链接或上传文件...'}
            rows={1}
            className="flex-1 border rounded-xl px-4 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && attachedFiles.length === 0}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
