// /login — email + password; unverified (403) ho to wahin email verify ka code
// code sahi hote hi backend login bhi kar deta hai — seedha dashboard
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { login as loginRequest } from '../api/authApi'
import Alert from '../components/Alert'
import PasswordInput from '../components/PasswordInput'
import VerifyEmail from '../components/VerifyEmail'
import { useAuth } from '../hooks/useAuth'
import { button, card, cn, field, form, input, label, link, muted, title } from '../ui/styles'
import { toAlert } from '../utils/helpers'

export default function Login() {
  const { token, login, notice, setNotice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  // unverified login (403) par verify form — usi email + password ke liye jo 403 par bheje the
  // (baad mein input badal bhi jaye to verify aur dobara login isi account ka ho)
  const [verifyCreds, setVerifyCreds] = useState(null)

  // pehle se login hai to seedha dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  // verify-email ya login — dono { token, user } dete hain (refresh cookie backend lagata hai)
  function startSession(data) {
    login(data)
    navigate('/dashboard', { replace: true })
  }

  async function doLogin(creds) {
    setLoading(true)
    setNotice(null)
    try {
      startSession(await loginRequest(creds.email, creds.password))
    } catch (error) {
      setAlert(toAlert(error))
      setVerifyCreds(error.response?.status === 403 ? creds : null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await doLogin({ email, password })
  }

  return (
    <section className={card}>
      <h1 className={title}>Login</h1>
      {/* "Session expired" jaisa paigham (context se) ya is form ka apna jawab */}
      <Alert alert={alert || notice} />

      <form className={form} onSubmit={handleSubmit}>
        <div className={field}>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            className={input}
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" className={button()} disabled={loading}>
          {loading ? 'Please wait…' : 'Login'}
        </button>
      </form>

      {/* login form se alag dikhe — upar line */}
      {verifyCreds && (
        <div className="mt-[18px] border-t border-border pt-4">
          <VerifyEmail
            key={verifyCreds.email}
            email={verifyCreds.email}
            password={verifyCreds.password}
            onResult={setAlert}
            onVerified={startSession}
          />
        </div>
      )}

      <p className={cn(muted, 'mt-5 text-center')}>
        Account nahi hai?{' '}
        <Link to="/register" className={link}>
          Register karein
        </Link>
      </p>
    </section>
  )
}
