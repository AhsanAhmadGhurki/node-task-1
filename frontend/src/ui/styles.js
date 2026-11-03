// baar baar lagne wali Tailwind classes — ek jagah, taake har button/input ek jaisa dikhe
// (alag CSS file nahi — classes JSX mein, yahan sirf unke naam)
// rule: kisi base class ke upar wahi property dobara mat jodo (Tailwind mein tay nahi kaun jeete) — option ya *Base wala roop lo
// design ke qaide (docs/redesign/design.md): kone sirf rounded-md (controls) / rounded-lg (dabbe); shadow sirf Toast par;
// controls ki unchai sirf 32px (sm) ya 36px (md) — padding se nahi, h- se, taake har jagah barabar rahe

// cn — sirf sachi (truthy) classes jodo: cn('a', isOn && 'b') → "a b"
export const cn = (...classes) => classes.filter(Boolean).join(' ')

// keyboard se aane par saaf ring — mouse click par nahi (focus-visible)
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

// panel — bina padding ka dabba (list, jahan rows apni padding rakhein); card — padding ke saath
// shadow nahi — seedhi satah ko border hi alag karta hai, saaya sirf tairti cheez (Toast) par
export const panel = 'rounded-lg border border-border bg-card'
export const card = `${panel} p-5 sm:p-6`

// har logged-in page ka upar wala hissa — baayen title + ek line, daayen (agar ho) action
export const pageHeader = 'mb-6 flex items-end justify-between gap-4'
// pageTitle — page ki sabse badi heading; titleText — card/section ki heading (margin ke baghair); title — neeche jagah ke saath
export const pageTitle = 'text-2xl font-semibold tracking-tight'
export const titleText = 'text-base font-semibold'
export const title = `${titleText} mb-5`
export const subtitle = 'mt-1 text-sm text-muted'
// settings (Profile) ka ek section — md par baayen 200px mein section ka naam, daayen fields; phone par upar neeche
export const sectionRow = 'grid gap-4 p-5 sm:p-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8'

export const form = 'flex flex-col gap-4'
export const field = 'flex flex-col gap-1.5'
export const label = 'text-sm font-medium text-text'
// inputBase — unchai/padding/font-size ke baghair (icon wale, textarea ya code wale input apni dete hain); input — aam 36px wala
// aria-invalid — galat field ka border laal (Profile)
export const inputBase =
  'w-full min-w-0 rounded-md border border-input bg-card text-text transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-60 aria-invalid:border-error-text'
export const input = `${inputBase} h-9 px-3 text-sm`
export const muted = 'm-0 text-sm text-muted'
// hintText — rang ke baghair (jahan rang halat se badle, jaise counter); hint — muted rang ke saath
export const hintText = 'text-xs font-normal'
export const hint = `${hintText} text-muted`
export const link = 'font-medium text-primary-text underline-offset-4 hover:underline'

// button — variant: primary / secondary (border) / ghost (sirf hover par rang) / danger (laal likhai, border)
// size: md (36px, aam) / sm (32px, toolbar aur row ke andar) / icon (chokor 32px; touch par 40px)
// weight: semibold / medium — padding aur font-weight option se; upar se class jodne ke bajaye option badlo
const buttonBase = `inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`
const buttonVariants = {
  primary: 'bg-primary text-white hover:enabled:bg-primary-hover',
  secondary: 'border border-input bg-card text-text hover:enabled:bg-subtle',
  ghost: 'bg-transparent text-muted hover:enabled:bg-subtle hover:enabled:text-text',
  danger: 'border border-input bg-card text-error-text hover:enabled:border-error-text/40 hover:enabled:bg-error-bg',
}
const buttonSizes = {
  md: 'h-9 px-3.5',
  sm: 'h-8 px-3',
  // ungli ke liye 32px chhota — touch screen par 40px
  icon: 'size-8 pointer-coarse:size-10',
}

const buttonWeights = {
  semibold: 'font-semibold',
  medium: 'font-medium',
}

export function button({ variant = 'primary', size = 'md', weight = 'medium' } = {}) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], buttonWeights[weight])
}

// chhota label — ginti, type (PDF/IMG) waghaira
export const badge = 'inline-flex items-center rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium text-muted'
