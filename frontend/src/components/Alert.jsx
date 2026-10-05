// har response ka status + message — taake masla foran nazar aaye
// alert = { ok, status, text } (helpers.toAlert se ya khud banaya hua)
import { cn } from '../ui/styles'

export default function Alert({ alert }) {
  if (!alert) return null

  return (
    <div
      // wrap-anywhere — paigham mein task ka title hota hai; lamba shabd (bina space) bhi toote, warna page side mein scroll
      className={cn(
        'mb-[18px] rounded-lg px-3 py-2.5 text-sm wrap-anywhere',
        alert.ok ? 'bg-success-bg text-success-text' : 'bg-error-bg text-error-text',
      )}
      role={alert.ok ? 'status' : 'alert'}
    >
      <strong>{alert.status || 'ERR'}</strong> · {alert.text}
    </div>
  )
}
