// form ke upar ka paigham (login, register) — kamyabi hari, galti laal, icon ke saath
// alert = { ok, status, text } (helpers.toAlert se ya khud banaya hua); status code user ko nahi dikhate — sirf matlab ki baat
import { AlertIcon, CheckCircleIcon } from '../ui/icons'
import { cn } from '../ui/styles'

export default function Alert({ alert }) {
  if (!alert) return null

  const Icon = alert.ok ? CheckCircleIcon : AlertIcon
  return (
    <div
      // wrap-anywhere — paigham mein task ka title hota hai; lamba shabd (bina space) bhi toote, warna page side mein scroll
      className={cn(
        'mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm wrap-anywhere',
        alert.ok ? 'border-success-text/20 bg-success-bg text-success-text' : 'border-error-text/20 bg-error-bg text-error-text',
      )}
      role={alert.ok ? 'status' : 'alert'}
    >
      <Icon className="mt-px size-4 shrink-0" />
      <span className="min-w-0">{alert.text}</span>
    </div>
  )
}
