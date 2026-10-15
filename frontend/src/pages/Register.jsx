// /register — do screens: pehle account banao, phir email par aaya 6-digit code
// code sahi hote hi seedha login aur dashboard — password dobara nahi poochte
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { register } from '../api/authApi'
import Alert from '../components/Alert'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'
import VerifyEmail from '../components/VerifyEmail'
import { useAuth } from '../hooks/useAuth'
import { ArrowLeftIcon, CheckIcon } from '../ui/icons'
import { button, cn, field, form, input, label, link } from '../ui/styles'
import { passwordChecks, passwordRuleError, toAlert } from '../utils/helpers'

export default function Register() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)
  // 201 ke baad verify screen — usi email + password ke saath (password verify ke saath jaata hai, wahi account ka banta hai)
  const [verifyCreds, setVerifyCreds] = useState(null)
  // 409 — verified account; code screen nahi (koi code gaya hi nahi), login ka rasta dikhao
  const [alreadyRegistered, setAlreadyRegistered] = useState(false)

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // backend wale rules pehle hi — "        1" jaisa password request tak na jaye
    const invalidPassword = passwordRuleError(password)
    if (invalidPassword) {
      setAlert({ ok: false, status: 'Form', text: invalidPassword })
      return
    }
    setLoading(true)
    try {
      const { created, data } = await register(email, password)
      // 200 = pehle se unverified account (naya nahi bana) — backend ka generic paigham, lekin code phir bhi jaata hai
      setAlert(
        created
          ? { ok: true, status: 201, text: 'Account ban gaya! Ab email verify karein.' }
          : { ok: true, status: 200, text: data.message },
      )
      // backend jaisi hi shakal — "QA@X.com " aur "qa@x.com" ek hi account
      setVerifyCreds({ email: created ? data.email : email.trim().toLowerCase(), password })
      setAlreadyRegistered(false)
    } catch (error) {
      setAlert(toAlert(error))
      setAlreadyRegistered(error.response?.status === 409)
    } finally {
      setLoading(false)
    }
  }

  // code sahi — backend ne login bhi kar diya (token + refresh cookie)
  function handleVerified(data) {
    login(data)
    navigate('/dashboard', { replace: true })
  }

  // galat email likha tha — form par wapas (password bhi saaf, dobara likhwao)
  function startOver() {
    setVerifyCreds(null)
    setPassword('')
    setAlert(null)
  }

  if (verifyCreds) {
    return (
      <AuthLayout
        heading="Email verify karein"
        description="Account banane ka aakhri qadam."
        footer={
          <button type="button" className={button({ variant: 'ghost', size: 'sm', weight: 'medium' })} onClick={startOver}>
            <ArrowLeftIcon />
            Galat email? Wapas register par
          </button>
        }
      >
        <Alert alert={alert} />
        <VerifyEmail
          key={verifyCreds.email}
          email={verifyCreds.email}
          password={verifyCreds.password}
          sent
          onResult={setAlert}
          onVerified={handleVerified}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      heading="Account banayein"
      description="Shuru karne mein ek minute lagta hai."
      footer={
        <>
          Pehle se account hai?{' '}
          <Link to="/login" className={link}>
            Login karein
          </Link>
        </>
      }
    >
      <Alert alert={alert} />

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
        {/* backend ke rules — likhte waqt hi har rule ka check, taake 400 kam aaye */}
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password">
          <ul className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
            {passwordChecks(password).map(([rule, ok]) => (
              <li key={rule} className={cn('flex items-center gap-1.5', ok ? 'text-success-text' : 'text-muted')}>
                <span
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-full',
                    ok ? 'bg-success-text text-card' : 'border border-border',
                  )}
                >
                  {ok && <CheckIcon className="size-2.5" strokeWidth={4} />}
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </PasswordInput>
        <button type="submit" className={cn(button({ size: 'lg' }), 'mt-2 w-full')} disabled={loading}>
          {loading ? 'Please wait…' : 'Account banayein'}
        </button>
      </form>

      {alreadyRegistered && (
        <p className="mt-4 text-sm text-muted">
          Is email se account pehle se hai —{' '}
          <Link to="/login" className={link}>
            Login karein
          </Link>
          .
        </p>
      )}
    </AuthLayout>
  )
}
