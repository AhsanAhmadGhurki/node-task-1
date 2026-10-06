// logged-in user + token ki global state — har page useAuth() se parhta hai
import { useCallback, useEffect, useMemo, useState } from 'react'
import { logout as logoutRequest } from '../api/authApi'
import { setAuthHandlers } from '../api/axios'
import { AuthContext } from '../hooks/useAuth'
import { clearSession, loadSession, saveSession } from '../utils/helpers'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)
  // login page par dikhane wala paigham — jaise "Session expired"
  const [notice, setNotice] = useState(null)

  const login = useCallback(({ token, user }) => {
    saveSession({ token, user })
    setSession({ token, user })
    setNotice(null)
  }, [])

  // user ki koi field badli (jaise naya avatar) — state aur localStorage dono, taake reload par bhi wahi
  const updateUser = useCallback((changes) => {
    setSession((current) => {
      if (!current) return current
      const next = { ...current, user: { ...current.user, ...changes } }
      saveSession(next)
      return next
    })
  }, [])

  // sirf browser ki taraf se — localStorage saaf, state khaali, login page par paigham
  const clearLocalSession = useCallback((reason = null) => {
    clearSession()
    setSession(null)
    setNotice(reason)
  }, [])

  // user ne "Logout" dabaya — backend refresh token bhi band kare (warna cookie se dobara login ho jata)
  // backend tak na pahunche to bhi browser se logout karo
  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // network/backend error — koi baat nahi, local session phir bhi khatam
    }
    clearLocalSession()
  }, [clearLocalSession])

  // axios ko batao: naya token aaye to state update, refresh bhi fail ho to logout
  useEffect(() => {
    setAuthHandlers({
      onRefreshed: ({ token, user }) => setSession({ token, user }),
      onUnauthorized: () => clearLocalSession({ ok: false, status: 401, text: 'Session expired — dobara login karein' }),
    })
  }, [clearLocalSession])

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, login, logout, updateUser, notice, setNotice }),
    [session, login, logout, updateUser, notice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
