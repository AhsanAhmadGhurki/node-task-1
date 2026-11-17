// Profile ka "Password" hissa — maujooda + naya password; kamyabi par backend naya token deta hai (baqi devices logout)
// onResult — parent ka Toast; naya token session mein login() se (purana token ab rad ho chuka)
import { useRef, useState } from 'react'
import { changePassword } from '../api/userApi'
import { useAuth } from '../hooks/useAuth'
import { button, cn, form, hint, hintText, sectionRow, titleText } from '../ui/styles'
import { passwordRuleError, toAlert } from '../utils/helpers'
import PasswordChecklist from './PasswordChecklist'
import PasswordInput from './PasswordInput'

export default function ChangePassword({ onResult }) {
  const { login } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  // busy state der se badalta hai — ek hi tick mein do submit na jaayein
  const inFlight = useRef(false)

  const sameAsCurrent = next !== '' && next === current
  const ready = current !== '' && !passwordRuleError(next) && !sameAsCurrent

  async function handleSubmit(e) {
    e.preventDefault()
    if (inFlight.current || !ready) return
    inFlight.current = true
    setBusy(true)
    try {
      const data = await changePassword(current, next)
      // purana token password badalte hi rad — naya token aur user session mein (refresh cookie backend ne badal di)
      login({ token: data.token, user: data.user })
      setCurrent('')
      setNext('')
      onResult({ ok: true, status: 200, text: data.message })
    } catch (error) {
      onResult(toAlert(error))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={sectionRow}>
        <div>
          <h2 className={titleText}>Password</h2>
          <p className={cn(hint, 'mt-1')}>Badalne par baqi saare devices se logout ho jayega.</p>
        </div>
        <div className={form}>
          <PasswordInput
            value={current}
            onChange={setCurrent}
            autoComplete="current-password"
            labelText="Maujooda password"
            name="current-password"
          />
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" labelText="Naya password" name="new-password">
            <PasswordChecklist password={next} />
            {sameAsCurrent && <span className={cn(hintText, 'mt-1 block text-error-text')}>Naya password purane se alag ho.</span>}
          </PasswordInput>
        </div>
      </div>
      <div className="flex justify-end rounded-b-lg border-t border-border bg-subtle/40 px-5 py-3 sm:px-6">
        <button type="submit" className={button()} disabled={busy || !ready}>
          {busy ? 'Badal raha hai…' : 'Password badlo'}
        </button>
      </div>
    </form>
  )
}
