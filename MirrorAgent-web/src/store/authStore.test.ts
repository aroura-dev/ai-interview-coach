import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ token: null, username: null })
  })

  it('登录时写入内存和 localStorage', () => {
    useAuthStore.getState().login('token-1', 'tester')

    expect(useAuthStore.getState().token).toBe('token-1')
    expect(useAuthStore.getState().username).toBe('tester')
    expect(localStorage.getItem('token')).toBe('token-1')
    expect(localStorage.getItem('username')).toBe('tester')
  })

  it('退出时清理内存和 localStorage', () => {
    useAuthStore.getState().login('token-1', 'tester')
    useAuthStore.getState().logout()

    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().username).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('username')).toBeNull()
  })
})