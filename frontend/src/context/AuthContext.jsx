// logged-in user + token ki global state — har page useAuth() se parhta hai
import { useCallback, useEffect, useMemo, useState } from 'react'
import { setUnauthorizedHandler } from '../api/axios'
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

  const logout = useCallback((reason = null) => {
    clearSession()
    setSession(null)
    setNotice(reason)
  }, [])

  // kisi bhi request par token expire ho (401) to yahin se logout — ProtectedRoute khud /login bhej dega
  useEffect(() => {
    setUnauthorizedHandler(() => logout({ ok: false, status: 401, text: 'Session expired — dobara login karein' }))
  }, [logout])

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, login, logout, notice, setNotice }),
    [session, login, logout, notice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
