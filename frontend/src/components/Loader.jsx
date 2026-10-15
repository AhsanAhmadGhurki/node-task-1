// load hote waqt skeleton rows — asal list jaisi shakal, taake data aane par page na uchle
// text — screen reader ke liye (nazar nahi aata)
import { cn } from '../ui/styles'

export default function Loader({ text = 'Loading…', rows = 3 }) {
  return (
    <div className="flex flex-col gap-3 py-2" role="status">
      <span className="sr-only">{text}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3" aria-hidden="true">
          <span className="size-5 shrink-0 rounded-md bg-subtle" />
          <span className={cn('h-3.5 rounded-full bg-subtle', ['w-3/5', 'w-4/5', 'w-2/5'][i % 3])} />
        </div>
      ))}
    </div>
  )
}
