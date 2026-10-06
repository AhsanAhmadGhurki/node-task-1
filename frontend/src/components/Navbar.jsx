// upar ki patti — app ka naam, aur login ho to avatar (click = badlo) + email + logout
import { Link } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import AvatarButton from './AvatarButton'
import { button } from '../ui/styles'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
      <Link to="/" className="text-[17px] font-bold text-text no-underline">
        Tasks API
      </Link>
      {user && (
        <div className="flex min-w-0 items-center gap-3">
          <AvatarButton />
          {/* lamba email ek line mein, aakhir mein "…" */}
          <span className="truncate text-sm text-muted">{user.email}</span>
          <button className={button({ variant: 'secondary', size: 'sm' })} onClick={() => logout()}>
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
