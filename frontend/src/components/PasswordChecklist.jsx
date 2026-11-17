// naye password ke rules — likhte waqt hi har rule ka check (register, password reset, password badalna)
// backend ke rules jaise (helpers.passwordChecks), taake 400 kam aaye; PasswordInput ke children mein lagta hai
import { CheckIcon } from '../ui/icons'
import { cn } from '../ui/styles'
import { passwordChecks } from '../utils/helpers'

export default function PasswordChecklist({ password }) {
  return (
    // ek column — har rule apni line par, aankh upar se neeche padhti hai
    <ul className="mt-1 flex flex-col gap-1">
      {passwordChecks(password).map(([rule, ok]) => (
        <li key={rule} className={cn('flex items-center gap-1.5', ok ? 'text-success-text' : 'text-muted')}>
          <span
            className={cn(
              'flex size-3.5 shrink-0 items-center justify-center rounded-full',
              ok ? 'bg-success-text text-card' : 'border border-input',
            )}
          >
            {ok && <CheckIcon className="size-2.5" strokeWidth={4} />}
          </span>
          {rule}
        </li>
      ))}
    </ul>
  )
}
