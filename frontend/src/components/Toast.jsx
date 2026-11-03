// screen ke neeche tairta paigham (Dashboard, Tickets) — list upar neeche nahi hilti jaise inline Alert se hilti thi
// alert = { ok, status, text }; onClose — ✕ dabane par (galti ka paigham khud nahi hatta)
import { AlertIcon, CheckCircleIcon, XIcon } from '../ui/icons'
import { button, cn } from '../ui/styles'

export default function Toast({ alert, onClose }) {
  if (!alert) return null

  const Icon = alert.ok ? CheckCircleIcon : AlertIcon
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6">
      {/* app mein saaya sirf yahan — ye content ke upar tairta hai, baaki sab seedhi satah */}
      <div
        className="pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-lg border border-border bg-card py-1.5 pr-1.5 pl-3.5 text-sm shadow-md"
        role={alert.ok ? 'status' : 'alert'}
      >
        <Icon className={cn('size-4 shrink-0', alert.ok ? 'text-success-text' : 'text-error-text')} />
        <span className="min-w-0 flex-1 py-1.5 wrap-anywhere">{alert.text}</span>
        <button type="button" className={button({ variant: 'ghost', size: 'icon' })} onClick={onClose} aria-label="Band karein">
          <XIcon />
        </button>
      </div>
    </div>
  )
}
