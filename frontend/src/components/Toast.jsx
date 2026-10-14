// screen ke neeche tairta paigham (Dashboard, Tickets) — list upar neeche nahi hilti jaise inline Alert se hilti thi
// alert = { ok, status, text }; onClose — ✕ dabane par (galti ka paigham khud nahi hatta)
import { AlertIcon, CheckCircleIcon, XIcon } from '../ui/icons'
import { button, cn } from '../ui/styles'

export default function Toast({ alert, onClose }) {
  if (!alert) return null

  const Icon = alert.ok ? CheckCircleIcon : AlertIcon
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-border bg-card py-3 pr-2 pl-4 text-sm shadow-lg"
        role={alert.ok ? 'status' : 'alert'}
      >
        <Icon className={cn('mt-0.5 size-4 shrink-0', alert.ok ? 'text-success-text' : 'text-error-text')} />
        <span className="min-w-0 flex-1 py-0.5 wrap-anywhere">{alert.text}</span>
        <button type="button" className={button({ variant: 'ghost', size: 'icon' })} onClick={onClose} aria-label="Band karein">
          <XIcon />
        </button>
      </div>
    </div>
  )
}
