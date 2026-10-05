// load hote waqt chhota spinner
import { muted } from '../ui/styles'

export default function Loader({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-6" role="status">
      <span
        className="size-[18px] animate-spin rounded-full border-2 border-border border-t-primary [animation-duration:800ms]"
        aria-hidden="true"
      />
      <span className={muted}>{text}</span>
    </div>
  )
}
