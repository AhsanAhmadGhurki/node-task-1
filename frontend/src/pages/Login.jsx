// /login — email + password; unverified (403) ho to resend ka option
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { login as loginRequest } from '../api/authApi'
import Alert from '../components/Alert'
import ResendVerification from '../components/ResendVerification'
import { useAuth } from '../hooks/useAuth'
import { toAlert } from '../utils/helpers'

export default function Login() {
  const { token, login, notice, setNotice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  // unverified login par resend button isi email ke liye
  const [resendFor, setResendFor] = useState(null)

  // pehle se login hai to seedha dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setNotice(null)
    try {
      const data = await loginRequest(email, password)
      login(data)
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setAlert(toAlert(error))
      setResendFor(error.response?.status === 403 ? email : null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h1>Login</h1>
      {/* "Session expired" jaisa paigham (context se) ya is form ka apna jawab */}
      <Alert alert={alert || notice} />

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Please wait…' : 'Login'}</button>
      </form>

      {resendFor && <ResendVerification email={resendFor} onResult={setAlert} />}

      <p className="muted switch">
        Account nahi hai? <Link to="/register">Register karein</Link>
      </p>
    </section>
  )
}
