// upar ki patti — app ka naam, aur login ho to Tasks/Tickets links, avatar (click = badlo) + email + logout
import { Link, NavLink } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import AvatarButton from './AvatarButton'
import { button, cn } from '../ui/styles'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="flex items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
      {/* shrink-0 — links kabhi na dabein; jagah kam ho to right side ka email chhota hota hai */}
      <div className="flex shrink-0 items-center gap-4">
        <Link to="/" className="shrink-0 text-[17px] font-bold text-text no-underline">
          Tasks API
        </Link>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            {/* jis page par hain woh link gehra */}
            {[
              ['/dashboard', 'Tasks'],
              ['/tickets', 'Tickets'],
            ].map(([to, text]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => cn('no-underline', isActive ? 'font-semibold text-text' : 'text-muted hover:text-text')}
              >
                {text}
              </NavLink>
            ))}
          </div>
        )}
      </div>
      {user && (
        <div className="flex min-w-0 items-center gap-3">
          <AvatarButton />
          {/* lamba email ek line mein, aakhir mein "…"; phone par (sm se chhota) nahi — links, avatar, logout ke baad jagah nahi */}
          <span className="truncate text-sm text-muted max-sm:hidden">{user.email}</span>
          <button className={button({ variant: 'secondary', size: 'sm' })} onClick={() => logout()}>
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
