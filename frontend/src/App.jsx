import { useState } from 'react'
import { api } from './api'

// JWT ke beech wale hisse (payload) mein exp hota hai — seconds mein
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 < Date.now()
  } catch {
    // token parh hi na sakein to bhi expired maano
    return true
  }
}

// token aur user refresh ke baad bhi rahein — lekin expire ho chuka token wapas na lao
function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem('session'))
    if (!session || isTokenExpired(session.token)) {
      localStorage.removeItem('session')
      return null
    }
    return session
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState(loadSession)
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tasks, setTasks] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  // kis email ke liye "Resend verification email" button dikhana hai — null = button chhupa
  const [resendFor, setResendFor] = useState(null)

  // har response ka status + message dikhao — taake masla foran nazar aaye
  function show(res, successText) {
    const text = res.ok ? successText : res.data?.message || 'Unknown error'
    setMessage({ ok: res.ok, status: res.status, text })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    // register root par hai (/register), login /auth/login par
    const path = tab === 'register' ? '/register' : '/auth/login'
    const res = await api('POST', path, { email, password })

    // email nahi mili / pehle register tha (409) / unverified login (403) — teeno mein resend ka rasta do
    setResendFor((tab === 'register' && (res.ok || res.status === 409)) || res.status === 403 ? email : null)

    if (tab === 'register') {
      // login se pehle verify zaroori — link email par jaata hai
      show(res, `User registered: ${res.data?.email}. Apna email inbox (ya Spam) check karein aur "Verify email" par click karein, phir login karein.`)
      if (res.ok) {
        setTab('login')
        setPassword('')
      }
    } else {
      show(res, 'Login successful — token mil gaya')
      if (res.ok) {
        const newSession = { token: res.data.token, user: res.data.user }
        localStorage.setItem('session', JSON.stringify(newSession))
        setSession(newSession)
        setPassword('')
      }
    }

    setLoading(false)
  }

  async function resendVerification() {
    setLoading(true)
    const res = await api('POST', '/resend-verification', { email: resendFor })
    setLoading(false)
    // backend ka message hi dikhao — "sent", "already verified", "wait 42 seconds", waghaira
    show(res, res.data?.message)
  }

  async function loadTasks() {
    setLoading(true)
    const res = await api('GET', '/tasks', null, session?.token)
    setLoading(false)

    // token expire/invalid — page par "Logged in" dikhate rehna galat hai, logout kar do
    if (res.status === 401) {
      logout()
      setMessage({ ok: false, status: 401, text: 'Session expired — dobara login karein' })
      return
    }

    show(res, `${res.data?.length} task(s) loaded`)
    setTasks(res.ok ? res.data : null)
  }

  function logout() {
    localStorage.removeItem('session')
    setSession(null)
    setTasks(null)
    setMessage(null)
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Tasks API</h1>

        {message && (
          <div className={`message ${message.ok ? 'success' : 'error'}`}>
            <strong>{message.status || 'ERR'}</strong> · {message.text}
          </div>
        )}

        {session ? (
          <section>
            <p className="muted">Logged in as</p>
            <p className="user-email">{session.user?.email}</p>

            <div className="row">
              <button onClick={loadTasks} disabled={loading}>Load my tasks</button>
              <button className="secondary" onClick={logout}>Logout</button>
            </div>

            {tasks && (
              tasks.length === 0 ? (
                <p className="muted">Koi task nahi hai.</p>
              ) : (
                <ul className="tasks">
                  {tasks.map((task) => (
                    <li key={task._id}>
                      <span className={task.completed ? 'done' : ''}>{task.title}</span>
                      <span className="badge">{task.completed ? 'done' : 'pending'}</span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </section>
        ) : (
          <section>
            <div className="tabs">
              <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setMessage(null); setResendFor(null) }}>
                Login
              </button>
              <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setMessage(null); setResendFor(null) }}>
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Email
                <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                />
              </label>
              <button type="submit" disabled={loading}>
                {loading ? 'Please wait…' : tab === 'login' ? 'Login' : 'Register'}
              </button>
            </form>

            {resendFor && (
              <div className="resend">
                <p className="muted">Verification email nahi mili ya link expire ho gaya?</p>
                <button type="button" className="secondary" onClick={resendVerification} disabled={loading}>
                  Resend verification email
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

export default App
