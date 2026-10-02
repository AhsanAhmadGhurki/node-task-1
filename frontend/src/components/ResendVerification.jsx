// "Resend verification email" — register ke baad, 409 par, ya unverified login (403) par
import { useState } from 'react'
import { resendVerification } from '../api/authApi'
import { toAlert } from '../utils/helpers'

// onResult — parent apne Alert mein backend ka jawab dikhata hai ("sent", "already verified", "wait 42 seconds")
export default function ResendVerification({ email, onResult }) {
  const [sending, setSending] = useState(false)

  async function handleClick() {
    setSending(true)
    try {
      const { message } = await resendVerification(email)
      onResult({ ok: true, status: 200, text: message })
    } catch (error) {
      onResult(toAlert(error))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="resend">
      <p className="muted">Verification email nahi mili ya link expire ho gaya?</p>
      <button type="button" className="secondary" onClick={handleClick} disabled={sending}>
        {sending ? 'Sending…' : 'Resend verification email'}
      </button>
    </div>
  )
}
