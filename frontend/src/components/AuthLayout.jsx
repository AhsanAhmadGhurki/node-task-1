// login / register ka dhaancha — bade screen par baayen rangeen panel (app kya karti hai), daayen form
// phone par sirf form, upar chhota logo
import { ListChecksIcon, LifeBuoyIcon, LogoMark, ShieldIcon } from '../ui/icons'

const FEATURES = [
  [ListChecksIcon, 'Tasks banao, edit karo, complete karo'],
  [LifeBuoyIcon, 'Support ticket — screenshot ya PDF ke saath'],
  [ShieldIcon, 'Email verification aur mehfooz session'],
]

export default function AuthLayout({ heading, description, children, footer }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-card shadow-sm lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between gap-12 overflow-hidden bg-primary p-10 text-white lg:flex">
        {/* sirf sajawat ke gol daire */}
        <span className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10" aria-hidden="true" />
        <span className="absolute -bottom-36 -left-24 size-96 rounded-full bg-white/5" aria-hidden="true" />

        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <LogoMark inverted />
          TaskDesk
        </div>
        <div className="relative">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Apne kaam aur support, ek hi jagah.</h2>
          <ul className="mt-8 flex flex-col gap-4 text-sm text-white/85">
            {FEATURES.map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">TaskDesk · Tasks API</p>
      </aside>

      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14">
        <div className="mx-auto w-full max-w-sm">
          <LogoMark className="mb-6 size-10 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
