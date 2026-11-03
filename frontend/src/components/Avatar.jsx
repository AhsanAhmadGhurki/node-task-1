// gol tasveer — sirf dikhati hai (click/upload nahi); tasveer na ho (ya load na ho) to naam (ya email) ka pehla harf
import { useAuth } from '../hooks/useAuth'
import { useFileUrl } from '../hooks/useFileUrl'
import { cn } from '../ui/styles'

// ring bhi size ke saath — base mein ek ring aur upar se doosri jodo to Tailwind mein tay nahi kaun jeete
const sizes = {
  sm: 'size-9 text-sm ring-2 ring-card',
  lg: 'size-20 text-3xl ring-4 ring-primary-soft',
}

export default function Avatar({ size = 'sm', className }) {
  const { user } = useAuth()
  // user.avatar = fileId — tasveer GET /files/:fileId se token ke saath (blob URL); jab tak na aaye, harf
  const { url } = useFileUrl(user.avatar)
  const letter = (user.name || user.email)[0].toUpperCase()

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-white',
        sizes[size],
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : letter}
    </span>
  )
}
