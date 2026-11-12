// /login — do qadam (2FA): email + password → email par login code → code se dashboard
// unverified (403) ho to wahin email verify ka code (code sahi hote hi backend login bhi kar deta hai)
import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { requestLoginOtp } from '../api/authApi'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import LoginCode from '../components/LoginCode'
import PasswordInput from '../components/PasswordInput'
import VerifyEmail from '../components/VerifyEmail'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeftIcon } from '../ui/icons'
import { button, cn, field, form, input, label, link } from '../ui/styles'
import { safeNext, toAlert } from '../utils/helpers'

export default function Login() {
  const { token, login, notice, setNotice } = useAuth()
  const navigate = useNavigate()
  // invite link se aaye (?next=/invitations/...) to login ke baad wahin wapas — warna dashboard
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  // unverified login (403) par verify form — usi email + password ke liye jo 403 par bheje the
  // (baad mein input badal bhi jaye to verify aur dobara login isi account ka ho)
  const [verifyCreds, setVerifyCreds] = useState(null)
  // password sahi (200) — code wali screen, usi email + password ke saath (naya code bhi inhi se)
  const [codeCreds, setCodeCreds] = useState(null)

  // pehle se login hai to seedha dashboard
  if (token) {
    return <Navigate to={next} replace />
  }

  // verify-email ya login code — dono { token, user } dete hain (refresh cookie backend lagata hai)
  function startSession(data) {
    login(data)
    navigate(next, { replace: true })
  }

  async function doLogin(creds) {
    setLoading(true)
    setNotice(null)
    try {
      const challenge = await requestLoginOtp(creds.email, creds.password)
      setAlert({ ok: true, status: 200, text: challenge.message })
      setVerifyCreds(null)
      setCodeCreds({ ...creds, challenge })
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

  // code screen se wapas — form wahi email/password ke saath, paigham saaf
  function backToForm() {
    setCodeCreds(null)
    setAlert(null)
  }

  if (codeCreds) {
    return (
      <AuthLayout
        heading="Login code daalein"
        description="Login ka aakhri qadam."
        footer={
          <button type="button" className={button({ variant: 'ghost', size: 'sm' })} onClick={backToForm}>
            <ArrowLeftIcon />
            Wapas login par
          </button>
        }
      >
        <Alert alert={alert} />
        <LoginCode
          key={codeCreds.email}
          email={codeCreds.email}
          password={codeCreds.password}
          challenge={codeCreds.challenge}
          onResult={setAlert}
          onLoggedIn={startSession}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      heading="Welcome back"
      description="Apne account mein login karein."
      footer={
        <>
          Account nahi hai?{' '}
          <Link to={`/register${searchParams.size ? `?${searchParams}` : ""}`} className={link}>
            Register karein
          </Link>
        </>
      }
    >
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
            placeholder="aap@example.com"
            required
          />
        </div>
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" className={cn(button(), 'mt-2 w-full')} disabled={loading}>
          {loading ? 'Please wait…' : 'Login'}
        </button>
      </form>

      {/* login form se alag dikhe — upar line */}
      {verifyCreds && (
        <div className="mt-6 border-t border-border pt-6">
          <VerifyEmail
            key={verifyCreds.email}
            email={verifyCreds.email}
            password={verifyCreds.password}
            onResult={setAlert}
            onVerified={startSession}
          />
        </div>
      )}
    </AuthLayout>
  )
}
