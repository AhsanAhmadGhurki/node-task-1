// koi route match nahi hua — backend ke notFound middleware jaisa
import { Link } from 'react-router'
import { ArrowLeftIcon } from '../ui/icons'
import { button, card, cn } from '../ui/styles'

export default function NotFound() {
  return (
    <section className={cn(card, 'mx-auto max-w-md text-center')}>
      <p className="text-6xl font-bold tracking-tight text-primary-text">404</p>
      <h1 className="mt-4 text-xl font-semibold">Ye page maujood nahi hai</h1>
      <p className="mt-1.5 text-sm text-muted">Link purana ho sakta hai, ya address mein typo hai.</p>
      <Link to="/" className={cn(button(), 'mt-6 no-underline')}>
        <ArrowLeftIcon />
        Home par jayein
      </Link>
    </section>
  )
}
