// koi route match nahi hua — backend ke notFound middleware jaisa
import { Link } from 'react-router'

export default function NotFound() {
  return (
    <section className="card center">
      <h1>404</h1>
      <p className="muted">Ye page maujood nahi hai.</p>
      <Link to="/">Home par jayein</Link>
    </section>
  )
}
