import { useEffect, useState } from 'react'
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
  // "Add task" form ka text
  const [newTitle, setNewTitle] = useState('')

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

  // /tasks ki har call isi se — token lagao, aur 401 par (token expire/invalid) logout
  // null lautata hai jab session khatam ho gaya, taake caller aage kuch na kare
  async function taskApi(method, path, body) {
    setLoading(true)
    const res = await api(method, path, body, session?.token)
    setLoading(false)

    if (res.status === 401) {
      logout()
      setMessage({ ok: false, status: 401, text: 'Session expired — dobara login karein' })
      return null
    }

    return res
  }

  async function loadTasks() {
    const res = await taskApi('GET', '/tasks')
    if (!res) return

    if (res.ok) {
      setTasks(res.data)
    } else {
      show(res)
    }
  }

  async function addTask(e) {
    e.preventDefault()
    const res = await taskApi('POST', '/tasks', { title: newTitle })
    if (!res) return

    show(res, `Task added: ${res.data?.title}`)
    if (res.ok) {
      setTasks((current) => [...(current || []), res.data])
      setNewTitle('')
    }
  }

  async function toggleTask(task) {
    // sirf completed bhejo — backend PUT par sirf bheji hui fields badalta hai
    const res = await taskApi('PUT', `/tasks/${task._id}`, { completed: !task.completed })
    if (!res) return

    if (res.ok) {
      setTasks((current) => current.map((t) => (t._id === task._id ? res.data : t)))
    } else {
      show(res)
    }
  }

  async function deleteTask(task) {
    const res = await taskApi('DELETE', `/tasks/${task._id}`)
    if (!res) return

    show(res, `Task deleted: ${task.title}`)
    if (res.ok) {
      setTasks((current) => current.filter((t) => t._id !== task._id))
    }
  }

  // login hote hi (ya refresh par session mile to) tasks khud load karo — button dabane ki zaroorat nahi
  useEffect(() => {
    if (session?.token) {
      loadTasks()
    }
    // sirf token badalne par — loadTasks har render par naya banta hai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token])

  function logout() {
    localStorage.removeItem('session')
    setSession(null)
    setTasks(null)
    setMessage(null)
    setNewTitle('')
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
              <button className="secondary" onClick={loadTasks} disabled={loading}>Refresh</button>
              <button className="secondary" onClick={logout}>Logout</button>
            </div>

            <form className="add-task" onSubmit={addTask}>
              <input
                name="title"
                placeholder="Naya task likhein…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                aria-label="New task title"
              />
              <button type="submit" disabled={loading || newTitle.trim() === ''}>Add</button>
            </form>

            {tasks && (
              tasks.length === 0 ? (
                <p className="muted empty">Koi task nahi hai — upar se naya add karein.</p>
              ) : (
                <ul className="tasks">
                  {tasks.map((task) => (
                    <li key={task._id}>
                      <label className="task-label">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task)}
                          disabled={loading}
                        />
                        <span className={task.completed ? 'done' : ''}>{task.title}</span>
                      </label>
                      <button
                        className="delete"
                        onClick={() => deleteTask(task)}
                        disabled={loading}
                        aria-label={`Delete ${task.title}`}
                        title="Delete"
                      >
                        ×
                      </button>
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
