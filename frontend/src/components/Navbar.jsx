// upar ki patti (sirf login ke baad) — logo, Tasks/Tickets links, avatar + naam (click = profile) aur logout
// sticky — lambi list scroll karte waqt bhi navigation saamne rahe; thos rang (blur nahi) — peeche saada background hi hai
import { Link, NavLink } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import Avatar from './Avatar'
import { LifeBuoyIcon, ListChecksIcon, LogOutIcon, LogoMark } from '../ui/icons'
import { button, cn, focusRing } from '../ui/styles'

const LINKS = [
  ['/dashboard', 'Tasks', ListChecksIcon],
  ['/tickets', 'Tickets', LifeBuoyIcon],
]

export default function Navbar() {
  const { user, logout } = useAuth()

  // login/register par patti nahi — AuthLayout ka apna logo hai, do baar dikhta
  if (!user) return null

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <nav className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          <Link to="/" className={cn('flex items-center gap-2 rounded-md text-sm font-semibold text-text no-underline', focusRing)}>
            <LogoMark />
            {/* phone par sirf nishan — links ke liye jagah */}
            <span className="max-sm:hidden">TaskDesk</span>
          </Link>
          <div className="flex items-center gap-1">
            {LINKS.map(([to, text, Icon]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium no-underline transition-colors',
                    focusRing,
                    // jis page par hain woh halki grey pill aur gehri likhai — rang sirf asal action ke liye bachta hai
                    isActive ? 'bg-subtle text-text' : 'text-muted hover:bg-subtle hover:text-text',
                  )
                }
              >
                <Icon />
                {text}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* naam (na ho to email) + tasveer = profile ka rasta; photo profile page par badalti hai */}
          <Link
            to="/profile"
            className={cn('group flex min-w-0 items-center gap-2.5 rounded-md no-underline', focusRing)}
            title="Profile"
            aria-label={`Profile: ${user.name || user.email}`}
          >
            {/* lamba naam ek line mein, aakhir mein "…"; chhote screen par nahi — links, avatar, logout ke baad jagah nahi */}
            <span className="truncate text-sm text-muted transition-colors group-hover:text-text max-md:hidden">
              {user.name || user.email}
            </span>
            <Avatar />
          </Link>
          <button
            className={button({ variant: 'ghost', size: 'sm' })}
            onClick={() => logout()}
            aria-label="Logout"
            title="Logout"
          >
            <LogOutIcon />
            <span className="max-sm:hidden">Logout</span>
          </button>
        </div>
      </nav>
    </header>
  )
}
