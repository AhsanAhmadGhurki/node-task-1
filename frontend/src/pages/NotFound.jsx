// koi route match nahi hua — backend ke notFound middleware jaisa
// card ke baghair, beech mein saada tehreer — bada rangeen "404" nahi, asal baat heading hai
import { Link } from 'react-router'
import { ArrowLeftIcon } from '../ui/icons'
import { button, cn } from '../ui/styles'

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md pt-12 text-center">
      <p className="text-xs font-medium text-muted tabular-nums">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ye page maujood nahi hai</h1>
      <p className="mt-2 text-sm text-muted">Link purana ho sakta hai, ya address mein typo hai.</p>
      <Link to="/" className={cn(button({ variant: 'secondary' }), 'mt-6 no-underline')}>
        <ArrowLeftIcon />
        Home par jayein
      </Link>
    </section>
  )
}
