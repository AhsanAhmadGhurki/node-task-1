// apni profile — tasveer, name aur phone; khulte hi DB se taaza (GET), save par sirf badli hui fields (PATCH)
import { useEffect, useId, useRef, useState } from 'react'
import { getProfile, updateProfile } from '../api/userApi'
import Alert from '../components/Alert'
import AvatarUpload from '../components/AvatarUpload'
import Loader from '../components/Loader'
import { useAuth } from '../hooks/useAuth'
import { button, card, cn, field, form, hint, hintText, input, label, muted, title } from '../ui/styles'
import { NAME_MAX_LENGTH, profileFieldErrors, toAlert } from '../utils/helpers'

export default function Profile() {
  const { user, updateUser } = useAuth()
  // purane session mein name/phone the hi nahi — khaali se shuru
  const saved = { name: user.name ?? '', phone: user.phone ?? '' }
  const [values, setValues] = useState(saved)
  const [alert, setAlert] = useState(null)
  // backend ke errors array se — har field ke neeche uski galti
  const [serverErrors, setServerErrors] = useState({})
  const [busy, setBusy] = useState(false)
  // busy state der se badalta hai — ek hi tick mein do submit na jaayein
  const inFlight = useRef(false)
  const nameId = useId()
  const phoneId = useId()
  // DB se profile aane tak form nahi — warna purane session ki khaali values dikhti, phir badal jaatin
  const [loaded, setLoaded] = useState(false)

  // page khulte hi DB se taaza profile — purane login ke session mein name/phone hote hi nahi
  // state sirf jawab aane par; cancelled — jawab se pehle page band ho to state na badle
  useEffect(() => {
    let cancelled = false
    getProfile()
      .then(({ user: fresh }) => {
        if (cancelled) return
        updateUser({ name: fresh.name, phone: fresh.phone, avatar: fresh.avatar })
        setValues({ name: fresh.name ?? '', phone: fresh.phone ?? '' })
        setLoaded(true)
      })
      .catch((error) => {
        if (cancelled) return
        setAlert(toAlert(error))
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [updateUser])

  // sirf woh fields jo saved se alag hain (trim ke baad) — wahi bhejni hain, wahi check honi hain
  const changes = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([key, value]) => value !== saved[key]),
  )
  const clientErrors = Object.fromEntries(
    Object.entries(profileFieldErrors(values)).filter(([key]) => key in changes),
  )
  const errors = { ...clientErrors, ...serverErrors }
  const nothingChanged = Object.keys(changes).length === 0

  function handleChange(key, value) {
    setValues((current) => ({ ...current, [key]: value }))
    // user ne field badal di — purani server galti ab us value ki nahi
    // key hatao, undefined nahi — { name: undefined } spread mein client wali galti ko bhi mita deta
    setServerErrors(({ [key]: _removed, ...rest }) => rest)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setAlert(null)
    try {
      const data = await updateProfile(changes)
      updateUser({ name: data.user.name, phone: data.user.phone })
      setValues({ name: data.user.name ?? '', phone: data.user.phone ?? '' })
      setServerErrors({})
      setAlert({ ok: true, status: 200, text: data.message })
    } catch (error) {
      // 400 par backend saari galtiyan ek saath deta hai — { errors: [{ field, message }] }
      const fieldErrors = error.response?.data?.errors ?? []
      setServerErrors(Object.fromEntries(fieldErrors.map((item) => [item.field, item.message])))
      setAlert(toAlert(error))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div className={card}>
      <h1 className={title}>Profile</h1>
      <AvatarUpload />
      <p className={cn(muted, 'mb-5 wrap-anywhere')}>{user.email}</p>
      <Alert alert={alert} />

      {!loaded ? (
        <Loader />
      ) : (
        <form className={form} onSubmit={handleSubmit} noValidate>
          <div className={field}>
            <label className={label} htmlFor={nameId}>
              Name
            </label>
            <input
              id={nameId}
              className={input}
              value={values.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ali Khan"
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && <span className={cn(hintText, 'text-error-text')}>{errors.name}</span>}
          </div>

          <div className={field}>
            <label className={label} htmlFor={phoneId}>
              Phone
            </label>
            <input
              id={phoneId}
              className={input}
              value={values.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="03001234567"
              inputMode="numeric"
              maxLength={11}
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone ? (
              <span className={cn(hintText, 'text-error-text')}>{errors.phone}</span>
            ) : (
              <span className={hint}>03XXXXXXXXX — bilkul 11 digits, spaces ya dash nahi</span>
            )}
          </div>

          <button
            type="submit"
            className={button()}
            disabled={busy || nothingChanged || Object.keys(clientErrors).length > 0}
          >
            {busy ? 'Save ho raha hai…' : 'Save'}
          </button>
        </form>
      )}
    </div>
  )
}
