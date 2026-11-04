// login ka doosra qadam (2FA) — password sahi tha, ab email par aaya 6-digit code
// code sahi ho to onLoggedIn({ token, user }) — parent session banata hai
import { useEffect, useState } from 'react'
import { requestLoginOtp, verifyLoginOtp } from '../api/authApi'
import { button, cn, field, form, inputBase, label } from '../ui/styles'
import { toAlert } from '../utils/helpers'

// code abhi gaya hai — itni der "Naya code bhejo" band, pehle wale ke aane ka intezar
const RESEND_COOLDOWN_SECONDS = 60

// 75 → "1:15", 3600 → "60:00" — 429 par ghante tak ka intezar bhi padhne layak
function formatWait(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// email + password — login form ka jo request-otp par bheja tha (naya code bhi isi se)
// onResult — parent apne Alert mein backend ka jawab dikhata hai
export default function LoginCode({ email, password, onResult, onLoggedIn }) {
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  // har second ginti kam — setState timer ke callback mein (effect mein seedha nahi)
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleVerify(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await verifyLoginOtp(email, otp)
      // busy wapas false nahi — parent dashboard par le jaata hai, ye component hat jaata hai
      onLoggedIn(data)
    } catch (error) {
      onResult(toAlert(error))
      setBusy(false)
    }
  }

  async function handleResend() {
    setBusy(true)
    try {
      const { message } = await requestLoginOtp(email, password)
      onResult({ ok: true, status: 200, text: message })
      setOtp('')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      onResult(toAlert(error))
      // 429 — backend batata hai kitni der (retryAfter, seconds); utni der button band
      const retryAfter = Number(error.response?.data?.retryAfter)
      if (error.response?.status === 429 && retryAfter > 0) {
        setCooldown(Math.ceil(retryAfter))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={form} onSubmit={handleVerify}>
      <p className="m-0 text-sm leading-relaxed text-muted">
        <strong className="font-medium text-text wrap-anywhere">{email}</strong> par 6-digit login code bheja gaya hai (Spam
        bhi dekhein). 5 minute tak chalega.
      </p>
      <div className={field}>
        <label htmlFor="login-otp" className={label}>
          Login code
        </label>
        <input
          id="login-otp"
          // VerifyEmail jaisa — 48px, bade door door digits
          className={cn(inputBase, 'h-12 px-3 text-center font-mono text-2xl font-medium tracking-[0.3em]')}
          type="text"
          name="otp"
          placeholder="••••••"
          value={otp}
          // sirf digits, zyada se zyada 6 — paste mein spaces aa jayein to bhi
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </div>
      <button type="submit" className={cn(button(), 'w-full')} disabled={busy || otp.length !== 6}>
        {busy ? 'Please wait…' : 'Login'}
      </button>
      <button
        type="button"
        className={cn(button({ variant: 'ghost' }), 'w-full')}
        onClick={handleResend}
        disabled={busy || cooldown > 0}
      >
        {cooldown > 0 ? `Naya code bhejo (${formatWait(cooldown)})` : 'Naya code bhejo'}
      </button>
    </form>
  )
}
