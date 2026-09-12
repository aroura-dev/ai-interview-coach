import { useEffect, useRef, useState } from 'react'
import { login, register } from '../api/auth'
import { useAuthStore } from '../store/authStore'

type FieldErrors = { username?: string; password?: string }

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  )
}

export function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const shakeTimer = useRef<number | undefined>(undefined)
  const auroraRef = useRef<HTMLDivElement>(null)
  const authLogin = useAuthStore((s) => s.login)

  const triggerShake = () => {
    setShake(false)
    window.clearTimeout(shakeTimer.current)
    requestAnimationFrame(() => setShake(true))
    shakeTimer.current = window.setTimeout(() => setShake(false), 450)
  }

  // 背景光晕层：鼠标极轻微视差（<=14px），rAF 缓动；reduced-motion / 非精确指针时不启用
  useEffect(() => {
    const layer = auroraRef.current
    if (!layer) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer: fine)').matches
    if (reduced || !finePointer) return

    let raf = 0
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0

    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }

    const loop = () => {
      cx += (tx * 14 - cx) * 0.06
      cy += (ty * 10 - cy) * 0.06
      layer.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
    }
  }, [])
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const u = username.trim()
    if (!u) errors.username = '请输入用户名'
    else if (u.length < 2 || u.length > 32) errors.username = '用户名需为 2-32 个字符'
    if (!password) errors.password = '请输入密码'
    else if (password.length < 6) errors.password = '密码至少 6 个字符'
    return errors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const res = isRegister
        ? await register(username.trim(), password)
        : await login(username.trim(), password)

      if (res.error) {
        setError(res.error)
        setPassword('')
        triggerShake()
      } else if (res.token && res.username) {
        authLogin(res.token, res.username)
      }
    } catch {
      setError('网络请求失败，请检查后端服务是否启动')
      setPassword('')
      triggerShake()
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (registerMode: boolean) => {
    if (registerMode === isRegister) return
    setIsRegister(registerMode)
    setError('')
    setFieldErrors({})
    setPassword('')
  }

  const inputBase =
    'w-full rounded-lg border bg-white py-2 pl-10 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:ring-2'

  return (
    <div className="login-bg relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* 细点阵：中心渐隐 */}
      <div aria-hidden="true" className="bg-dot-grid dot-mask pointer-events-none absolute inset-0" />

      {/* 超大品牌 M 水印（右下，淡印） */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-20 h-[440px] w-[440px] opacity-[0.06]"
        viewBox="0 0 512 512"
        fill="none"
      >
        <defs>
          <linearGradient id="w-cyan" x1="108" y1="113" x2="382" y2="405" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8bf1ff" />
            <stop offset=".42" stopColor="#22c7e6" />
            <stop offset="1" stopColor="#4568ff" />
          </linearGradient>
          <linearGradient id="w-violet" x1="408" y1="97" x2="122" y2="411" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c4a5ff" />
            <stop offset=".48" stopColor="#8e5bff" />
            <stop offset="1" stopColor="#4d31bf" />
          </linearGradient>
        </defs>
        <path d="M125 146h62l69 79 69-79h62L284 287v102h-56V287L125 146Z" fill="url(#w-cyan)" />
        <path d="M387 146h-62l-69 79-69-79h-62l103 141v102h56V287l103-141Z" fill="url(#w-violet)" opacity=".9" />
        <path d="M256 174 279 228l53 24-53 24-23 54-23-54-53-24 53-24 23-54Z" fill="#071321" stroke="#b7f8ff" strokeWidth="5" />
      </svg>

      {/* 卡片顶部一抹柔光，压住水印保证可读性 */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[26%] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[110px]" />
      {/* 背景微动效：3 个低透明度光斑缓慢漂移/呼吸（整体随鼠标轻微视差） */}
      <div ref={auroraRef} aria-hidden="true" className="pointer-events-none absolute -inset-8">
        <div className="animate-drift-a animate-breathe absolute -left-20 top-[6%] h-80 w-80 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="animate-drift-b animate-breathe absolute -right-16 top-[28%] h-96 w-96 rounded-full bg-violet-500/10 blur-3xl [animation-delay:1.4s]" />
        <div className="animate-drift-c animate-breathe absolute -bottom-24 left-[10%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl [animation-delay:2.6s]" />
      </div>
      <div className={`relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10 ${shake ? 'animate-shake' : ''}`}>
        {/* 品牌区 */}
        <div className="mb-6 text-center">
          <img src="/favicon.svg" alt="MirrorAgent" className="mx-auto h-16 w-16" />
          <h1 className="mt-4 bg-linear-to-r from-brand-700 via-brand-500 to-indigo-500 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            MirrorAgent
          </h1>
          <p className="mt-1 text-sm text-gray-400">越练越懂你的 AI 面试教练</p>
        </div>

        {/* 登录 / 注册 segmented tab */}
        <div className="relative mb-6 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm font-medium">
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%_-_0.25rem)] rounded-lg bg-white shadow transition-transform duration-200 ${isRegister ? 'translate-x-full' : 'translate-x-0'}`}
          />
          <button
            type="button"
            onClick={() => switchTab(false)}
            className={`relative z-10 rounded-lg py-2 transition ${
              !isRegister ? 'text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => switchTab(true)}
            className={`relative z-10 rounded-lg py-2 transition ${
              isRegister ? 'text-brand-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
              用户名
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <UserIcon />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }))
                }}
                placeholder="2-32 个字符"
                autoComplete="username"
                aria-invalid={!!fieldErrors.username}
                className={`${inputBase} ${
                  fieldErrors.username
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500/30'
                }`}
              />
            </div>
            {fieldErrors.username && <p className="mt-1 text-xs text-red-500">{fieldErrors.username}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              密码
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <LockIcon />
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                }}
                placeholder="至少 6 个字符"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                aria-invalid={!!fieldErrors.password}
                className={`${inputBase} pr-10 ${
                  fieldErrors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500/30'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-400 transition hover:text-gray-600"
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {fieldErrors.password && <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>}
          </div>

          <div aria-live="polite">
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
            )}
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          {isRegister ? '注册即自动登录，无需重复操作' : '还没有账号？点击上方「注册」立即体验'}
        </p>
      </div>
    </div>
  )
}