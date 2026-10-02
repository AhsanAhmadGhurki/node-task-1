// /register — account banao; verification email jaati hai, login se pehle verify zaroori
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { register } from '../api/authApi'
import Alert from '../components/Alert'
import ResendVerification from '../components/ResendVerification'
import { useAuth } from '../hooks/useAuth'
import { toAlert } from '../utils/helpers'

export default function Register() {
  const { token } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  // register ho gaya ya pehle se tha (409) — dono mein resend ka rasta do
  const [resendFor, setResendFor] = useState(null)

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await register(email, password)
      setAlert({
        ok: true,
        status: 201,
        text: `User registered: ${user.email}. Apna email inbox (ya Spam) check karein aur "Verify email" par click karein, phir login karein.`,
      })
      setResendFor(user.email)
      setPassword('')
    } catch (error) {
      setAlert(toAlert(error))
      setResendFor(error.response?.status === 409 ? email : null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <h1>Register</h1>
      <Alert alert={alert} />

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
            autoComplete="new-password"
            required
          />
          {/* backend ke rules — pehle se bata do taake 400 kam aaye */}
          <span className="hint">Kam se kam 8 characters, aur ek number</span>
        </label>
        <button type="submit" disabled={loading}>{loading ? 'Please wait…' : 'Register'}</button>
      </form>

      {resendFor && <ResendVerification email={resendFor} onResult={setAlert} />}

      <p className="muted switch">
        Pehle se account hai? <Link to="/login">Login karein</Link>
      </p>
    </section>
  )
}
