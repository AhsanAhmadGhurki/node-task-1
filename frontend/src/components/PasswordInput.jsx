// password field + aankh wala button — browser ka suggest kiya hua (ya galat type hua) password nazar aa jaye
// label htmlFor se input se juda — button label ke bahar, taake field ka naam sirf "Password" ho
import { useId, useState } from 'react'
import { EyeIcon, EyeOffIcon } from '../ui/icons'
import { cn, field, focusRing, hint as hintClass, inputBase, label } from '../ui/styles'

export default function PasswordInput({ value, onChange, autoComplete, hint, children }) {
  const [visible, setVisible] = useState(false)
  // har instance ka apna id — label/hint input se jud saken
  const id = useId()
  const hintId = `${id}-hint`

  return (
    <div className={field}>
      <label htmlFor={id} className={label}>
        Password
      </label>
      {/* button input ke andar daayen — input mein uske liye jagah (pr-10) */}
      <span className="relative">
        <input
          id={id}
          className={cn(inputBase, 'h-9 pr-10 pl-3 text-sm')}
          type={visible ? 'text' : 'password'}
          name="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-describedby={hint || children ? hintId : undefined}
          required
        />
        <button
          type="button"
          className={cn(
            'absolute inset-y-1 right-1 flex w-7 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-subtle hover:text-text',
            focusRing,
          )}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Password chhupao' : 'Password dikhao'}
          title={visible ? 'Chhupao' : 'Dikhao'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
      {/* hint — ek line; children — register ki rules checklist jaisa kuch bhi */}
      {(hint || children) && (
        <div id={hintId} className={hintClass}>
          {hint}
          {children}
        </div>
      )}
    </div>
  )
}
