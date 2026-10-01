import { useState } from 'react'
import { api } from './api'

// token aur user refresh ke baad bhi rahein
function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('session')) || null
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

  // har response ka status + message dikhao — taake masla foran nazar aaye
  function show(res, successText) {
    const text = res.ok ? successText : res.data?.message || 'Unknown error'
    setMessage({ ok: res.ok, status: res.status, text })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    const res = await api('POST', `/auth/${tab}`, { email, password })

    if (tab === 'register') {
      show(res, `User registered: ${res.data?.email}. Ab login karein.`)
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

  async function loadTasks() {
    setLoading(true)
    const res = await api('GET', '/tasks', null, session?.token)
    show(res, `${res.data?.length} task(s) loaded`)
    setTasks(res.ok ? res.data : null)
    setLoading(false)
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
              <button className={tab === 'login' ? 'active' : ''} onClick={() => { setTab('login'); setMessage(null) }}>
                Login
              </button>
              <button className={tab === 'register' ? 'active' : ''} onClick={() => { setTab('register'); setMessage(null) }}>
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
          </section>
        )}
      </div>
    </main>
  )
}

export default App
