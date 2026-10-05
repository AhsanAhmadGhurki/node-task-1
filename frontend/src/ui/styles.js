// baar baar lagne wali Tailwind classes — ek jagah, taake har button/input ek jaisa dikhe
// (alag CSS file nahi — classes JSX mein, yahan sirf unke naam)

// cn — sirf sachi (truthy) classes jodo: cn('a', isOn && 'b') → "a b"
export const cn = (...classes) => classes.filter(Boolean).join(' ')

export const card = 'w-full max-w-[420px] rounded-xl border border-border bg-card p-7'
// titleText — margin ke baghair (jahan heading kisi row mein ho); title — neeche jagah ke saath
export const titleText = 'text-[22px] font-bold'
export const title = `${titleText} mb-5`
export const form = 'flex flex-col gap-3.5'
export const field = 'flex flex-col gap-1.5'
export const label = 'text-sm font-medium'
export const input =
  'min-w-0 rounded-lg border border-border bg-bg px-3 py-2.5 text-text focus:outline-2 focus:-outline-offset-1 focus:outline-primary'
export const muted = 'm-0 text-sm text-muted'
// hintText — rang ke baghair (jahan rang halat se badle, jaise counter); hint — muted rang ke saath
export const hintText = 'text-xs font-normal'
export const hint = `${hintText} text-muted`
export const link = 'text-primary underline'

// button — variant: primary (neela) / secondary (border wala); size: md / compact (input ke saath) / sm
// padding aur font-weight option se — ek element par px-4 aur px-3 (ya font-semibold aur font-medium) dono hon
// to kaun jeete, Tailwind mein tay nahi; upar se class jodne ke bajaye option badlo
const buttonBase = 'cursor-pointer rounded-lg disabled:cursor-default disabled:opacity-60'
const buttonVariants = {
  primary: 'bg-primary text-white hover:enabled:bg-primary-hover',
  secondary: 'border border-border bg-transparent text-text hover:enabled:bg-bg',
}
const buttonSizes = {
  md: 'px-4 py-2.5',
  compact: 'px-3 py-2.5',
  sm: 'px-3 py-1.5 text-sm',
}

const buttonWeights = {
  semibold: 'font-semibold',
  medium: 'font-medium',
}

export function button({ variant = 'primary', size = 'md', weight = 'semibold' } = {}) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], buttonWeights[weight])
}
