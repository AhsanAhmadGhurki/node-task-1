// login / register ka dhaancha — saade background par beech mein ek patla card: upar logo, card mein heading + form,
// card ke neeche doosre page ka rasta. Rangeen panel / sajawati daire nahi — form hi is page ka asal kaam hai
// phone par card ka border/background hat jaata hai (poori screen hi card), taake chhoti screen par dabba-andar-dabba na lage
import { LogoMark } from '../ui/icons'

export default function AuthLayout({ heading, description, children, footer }) {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col sm:pt-8">
      <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold">
        <LogoMark />
        TaskDesk
      </div>

      <div className="sm:rounded-lg sm:border sm:border-border sm:bg-card sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">{heading}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
    </div>
  )
}
