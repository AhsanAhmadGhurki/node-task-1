// har response ka status + message — taake masla foran nazar aaye
// alert = { ok, status, text } (helpers.toAlert se ya khud banaya hua)
import { cn } from '../ui/styles'

// toast — screen ke neeche tairta hai, layout mein jagah nahi leta (Dashboard): banner aata/jaata to
// list neeche-upar khisakti aur click galat task par lagta. pointer-events-none — neeche wale buttons dabte rahein
export default function Alert({ alert, toast = false }) {
  if (!alert) return null

  return (
    <div
      // wrap-anywhere — paigham mein task ka title hota hai; lamba shabd (bina space) bhi toote, warna page side mein scroll
      className={cn(
        'rounded-lg px-3 py-2.5 text-sm wrap-anywhere',
        toast ? 'pointer-events-none fixed inset-x-4 bottom-4 z-10 mx-auto max-w-[420px] shadow-lg' : 'mb-[18px]',
        alert.ok ? 'bg-success-bg text-success-text' : 'bg-error-bg text-error-text',
      )}
      role={alert.ok ? 'status' : 'alert'}
    >
      <strong>{alert.status || 'ERR'}</strong> · {alert.text}
    </div>
  )
}
