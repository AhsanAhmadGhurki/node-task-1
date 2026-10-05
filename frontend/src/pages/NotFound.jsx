// koi route match nahi hua — backend ke notFound middleware jaisa
import { Link } from 'react-router'
import { card, cn, link, muted, title } from '../ui/styles'

export default function NotFound() {
  return (
    <section className={cn(card, 'text-center')}>
      <h1 className={title}>404</h1>
      <p className={muted}>Ye page maujood nahi hai.</p>
      <Link to="/" className={link}>
        Home par jayein
      </Link>
    </section>
  )
}
