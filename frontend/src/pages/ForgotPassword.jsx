// /forgot-password — do screens: pehle email, phir email par aaya code + naya password
// kamyabi par login page (backend login nahi karwata — naya password 2FA login se), wahan hara paigham
import { useEffect, useId, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { forgotPassword, resetPassword } from '../api/authApi'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import PasswordChecklist from '../components/PasswordChecklist'
import PasswordInput from '../components/PasswordInput'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeftIcon } from '../ui/icons'
import { button, cn, field, form, input, inputBase, label, link } from '../ui/styles'
import { passwordRuleError, toAlert } from '../utils/helpers'

// backend ek email par 60s mein ek hi code deta hai (429) — button utni der band
const RESEND_COOLDOWN_SECONDS = 60

export default function ForgotPassword() {
  const { token, setNotice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  // code bheja ja chuka — doosri screen; email wahi jo bheja (input baad mein badle to bhi)
  const [sentTo, setSentTo] = useState(null)
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleRequest(e) {
    e.preventDefault()
    setBusy(true)
    setAlert(null)
    try {
      const { message } = await forgotPassword(email)
      setAlert({ ok: true, status: 200, text: message })
      // backend jaisi hi shakal — "QA@X.com " aur "qa@x.com" ek hi account
      setSentTo(email.trim().toLowerCase())
    } catch (error) {
      setAlert(toAlert(error))
    } finally {
      setBusy(false)
    }
  }

  // naya password lag gaya — login page par hara paigham (notice), purana alert yahan reh jaata
  function handleDone(message) {
    setNotice({ ok: true, status: 200, text: message })
    navigate('/login', { replace: true })
  }

  if (sentTo) {
    return (
      <AuthLayout
        heading="Naya password chunein"
        description="Email par aaya code aur naya password daalein."
        footer={
          <button
            type="button"
            className={button({ variant: 'ghost', size: 'sm' })}
            onClick={() => {
              setSentTo(null)
              setAlert(null)
            }}
          >
            <ArrowLeftIcon />
            Galat email? Wapas
          </button>
        }
      >
        <Alert alert={alert} />
        <ResetForm key={sentTo} email={sentTo} onResult={setAlert} onDone={handleDone} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      heading="Password bhool gaye?"
      description="Apna email daalein — us par password badalne ka code aayega."
      footer={
        <Link to="/login" className={link}>
          Wapas login par
        </Link>
      }
    >
      <Alert alert={alert} />
      <form className={form} onSubmit={handleRequest}>
        <div className={field}>
          <label htmlFor="forgot-email" className={label}>
            Email
          </label>
          <input
            id="forgot-email"
            className={input}
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="aap@example.com"
            required
            autoFocus
          />
        </div>
        <button type="submit" className={cn(button(), 'mt-2 w-full')} disabled={busy}>
          {busy ? 'Please wait…' : 'Code bhejo'}
        </button>
      </form>
    </AuthLayout>
  )
}

// code + naya password; "Naya code bhejo" 60s ke baad (ya 429 ka retryAfter)
function ResetForm({ email, onResult, onDone }) {
  const codeId = useId()
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // abhi abhi code gaya hai — foran doosra mat maango
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  // har second ginti kam — setState timer ke callback mein (effect mein seedha nahi)
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleReset(e) {
    e.preventDefault()
    // backend wale rules pehle hi — kamzor password par request hi na jaye (code ki koshish bhi na kate)
    const invalidPassword = passwordRuleError(password)
    if (invalidPassword) {
      onResult({ ok: false, status: 'Form', text: invalidPassword })
      return
    }
    setBusy(true)
    try {
      const { message } = await resetPassword(email, otp, password)
      // busy wapas false nahi — parent login page par le jaata hai
      onDone(message)
    } catch (error) {
      onResult(toAlert(error))
      setBusy(false)
    }
  }

  async function handleResend() {
    setBusy(true)
    try {
      const { message } = await forgotPassword(email)
      onResult({ ok: true, status: 200, text: message })
      setOtp('')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      onResult(toAlert(error))
      // 429 — backend batata hai kitna rukna hai
      if (error.response?.status === 429) {
        setCooldown(error.response.data?.retryAfter || RESEND_COOLDOWN_SECONDS)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={form} onSubmit={handleReset}>
      <p className="m-0 text-sm leading-relaxed text-muted">
        Agar <strong className="font-medium text-text wrap-anywhere">{email}</strong> ka account hai to us par 6-digit code
        bheja gaya hai (Spam bhi dekhein). 5 minute tak chalega.
      </p>
      <div className={field}>
        <label htmlFor={codeId} className={label}>
          Code
        </label>
        <input
          id={codeId}
          // VerifyEmail jaisa — bade, door door digits (48px)
          className={cn(inputBase, 'h-12 px-3 text-center font-mono text-2xl font-medium tracking-[0.3em]')}
          type="text"
          name="otp"
          placeholder="••••••"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </div>
      <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" labelText="Naya password" name="new-password">
        <PasswordChecklist password={password} />
      </PasswordInput>
      <button type="submit" className={cn(button(), 'w-full')} disabled={busy || otp.length !== 6}>
        {busy ? 'Please wait…' : 'Password badlo'}
      </button>
      <button type="button" className={cn(button({ variant: 'ghost' }), 'w-full')} onClick={handleResend} disabled={busy || cooldown > 0}>
        {cooldown > 0 ? `Naya code bhejo (${cooldown}s)` : 'Naya code bhejo'}
      </button>
    </form>
  )
}
