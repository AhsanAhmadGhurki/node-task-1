// email verify ka code — register ke baad (201), ya unverified login (403) par
// code sahi ho to backend usi waqt login bhi kar deta hai — onVerified({ token, user }) se parent session banata hai
import { useEffect, useState } from 'react'
import { resendVerification, verifyEmail } from '../api/authApi'
import { button, field, form, input, label, muted } from '../ui/styles'
import { toAlert } from '../utils/helpers'

// onResult — parent apne Alert mein backend ka jawab dikhata hai
// password — register/login form wala; verify ke saath jaata hai aur wahi account ka password banta hai
// sent — code abhi abhi gaya hai (register 201 par); login 403 par koi naya code nahi jaata, wahan "bheja gaya" kehna jhoot hai
const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyEmail({ email, password, onResult, onVerified, sent = false }) {
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  // "Naya code bhejo" ke baad bhi — backend ka jawab generic hai, lekin unverified account ko code jaata hai
  const [codeRequested, setCodeRequested] = useState(sent)
  // "Naya code bhejo" kitne second baad — backend ek email par 60s mein ek hi resend deta hai (429)
  // abhi code gaya ho (register) to bhi 60s — code aane ka intezar karo, foran doosra mat maango
  const [cooldown, setCooldown] = useState(sent ? RESEND_COOLDOWN_SECONDS : 0)

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
      const data = await verifyEmail(email, otp, password)
      // busy wapas false nahi — parent dashboard par le jaata hai, ye component hat jaata hai
      onVerified(data)
    } catch (error) {
      onResult(toAlert(error))
      setBusy(false)
    }
  }

  async function handleResend() {
    setBusy(true)
    try {
      const { message } = await resendVerification(email)
      onResult({ ok: true, status: 200, text: message })
      setOtp('')
      setCodeRequested(true)
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      onResult(toAlert(error))
      // 429 — backend ne roka; button phir se 60s band (dobara dabane ka faida nahi)
      if (error.response?.status === 429) {
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={form} onSubmit={handleVerify}>
      {codeRequested ? (
        <p className={muted}>
          <strong>{email}</strong> par 6-digit code bheja gaya hai (Spam bhi dekhein). 5 minute tak chalega.
        </p>
      ) : (
        <p className={muted}>
          Email abhi verify nahi hua. &quot;Naya code bhejo&quot; dabayen, phir <strong>{email}</strong> par aaya 6-digit code yahan
          daalein.
        </p>
      )}
      <div className={field}>
        <label htmlFor="verify-otp" className={label}>
          Verification code
        </label>
        <input
          id="verify-otp"
          className={input}
          type="text"
          name="otp"
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
      <button type="submit" className={button()} disabled={busy || otp.length !== 6}>
        {busy ? 'Please wait…' : 'Verify & login'}
      </button>
      <button type="button" className={button({ variant: 'secondary' })} onClick={handleResend} disabled={busy || cooldown > 0}>
        {cooldown > 0 ? `Naya code bhejo (${cooldown}s)` : 'Naya code bhejo'}
      </button>
    </form>
  )
}
