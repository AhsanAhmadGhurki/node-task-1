// baar baar lagne wali Tailwind classes — ek jagah, taake har button/input ek jaisa dikhe
// (alag CSS file nahi — classes JSX mein, yahan sirf unke naam)
// rule: kisi base class ke upar wahi property dobara mat jodo (Tailwind mein tay nahi kaun jeete) — option ya *Base wala roop lo

// cn — sirf sachi (truthy) classes jodo: cn('a', isOn && 'b') → "a b"
export const cn = (...classes) => classes.filter(Boolean).join(' ')

// keyboard se aane par saaf ring — mouse click par nahi (focus-visible)
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

// panel — bina padding ka dabba (list, jahan rows apni padding rakhein); card — padding ke saath
export const panel = 'rounded-2xl border border-border bg-card shadow-sm'
export const card = `${panel} p-6 sm:p-8`

// pageTitle — page ki sabse badi heading; titleText — card ki heading (margin ke baghair); title — neeche jagah ke saath
export const pageTitle = 'text-2xl font-semibold tracking-tight sm:text-3xl'
export const titleText = 'text-lg font-semibold tracking-tight'
export const title = `${titleText} mb-5`
export const subtitle = 'mt-1 text-sm text-muted'

export const form = 'flex flex-col gap-4'
export const field = 'flex flex-col gap-1.5'
export const label = 'text-sm font-medium text-text'
// inputBase — padding ke baghair (icon wale ya code wale input apni padding dete hain); input — aam padding ke saath
export const inputBase =
  'w-full min-w-0 rounded-xl border border-border bg-card text-text shadow-xs transition placeholder:text-muted/70 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:opacity-60'
export const input = `${inputBase} px-3.5 py-2.5`
export const muted = 'm-0 text-sm text-muted'
// hintText — rang ke baghair (jahan rang halat se badle, jaise counter); hint — muted rang ke saath
export const hintText = 'text-xs font-normal'
export const hint = `${hintText} text-muted`
export const link = 'font-medium text-primary-text underline-offset-4 hover:underline'

// button — variant: primary / secondary (border) / ghost (sirf hover par rang) / danger
// size: md / lg / compact (input ke saath) / sm / icon (chokor, sirf icon); weight: semibold / medium
// padding aur font-weight option se — ek element par px-4 aur px-3 (ya font-semibold aur font-medium) dono hon
// to kaun jeete, Tailwind mein tay nahi; upar se class jodne ke bajaye option badlo
const buttonBase = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`
const buttonVariants = {
  primary: 'bg-primary text-white shadow-sm hover:enabled:bg-primary-hover',
  secondary: 'border border-border bg-card text-text shadow-xs hover:enabled:bg-subtle',
  ghost: 'bg-transparent text-muted hover:enabled:bg-subtle hover:enabled:text-text',
  danger: 'bg-error-bg text-error-text hover:enabled:bg-error-text hover:enabled:text-white',
}
const buttonSizes = {
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-[15px]',
  compact: 'px-3 py-2.5 text-sm',
  sm: 'px-3 py-1.5 text-sm',
  icon: 'size-9',
}

const buttonWeights = {
  semibold: 'font-semibold',
  medium: 'font-medium',
}

export function button({ variant = 'primary', size = 'md', weight = 'semibold' } = {}) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], buttonWeights[weight])
}

// chhota gol label — ginti, type (PDF/IMG) waghaira
export const badge = 'inline-flex items-center rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted'
