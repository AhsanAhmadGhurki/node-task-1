// password field + "dikhao" button — browser ka suggest kiya hua (ya galat type hua) password nazar aa jaye
// label htmlFor se input se juda — button label ke bahar, taake field ka naam sirf "Password" ho
import { useId, useState } from 'react'
import { button, cn, field, hint as hintClass, input, label } from '../ui/styles'

export default function PasswordInput({ value, onChange, autoComplete, hint }) {
  const [visible, setVisible] = useState(false)
  // har instance ka apna id — label/hint input se jud saken
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className={field}>
      <label htmlFor={id} className={label}>
        Password
      </label>
      {/* input baaki jagah le, button apni */}
      <span className="flex gap-2">
        <input
          id={id}
          className={cn(input, 'flex-1')}
          type={visible ? 'text' : 'password'}
          name="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={hint ? hintId : undefined}
          required
        />
        <button
          type="button"
          className={button({ variant: 'secondary', size: 'compact', weight: 'medium' })}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Password chhupao' : 'Password dikhao'}
        >
          {visible ? 'Chhupao' : 'Dikhao'}
        </button>
      </span>
      {hint && (
        <span id={hintId} className={hintClass}>
          {hint}
        </span>
      )}
    </div>
  )
}
