// gol tasveer — sirf dikhati hai (click/upload nahi); tasveer na ho to naam (ya email) ka pehla harf
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../ui/styles'

// ring bhi size ke saath — base mein ek ring aur upar se doosri jodo to Tailwind mein tay nahi kaun jeete
const sizes = {
  sm: 'size-9 text-sm ring-2 ring-card',
  lg: 'size-20 text-3xl ring-4 ring-primary-soft',
}

export default function Avatar({ size = 'sm', className }) {
  const { user } = useAuth()
  // jo src load na ho saka (file disk se mit gayi) — us par harf dikhao, toota icon nahi
  const [failedSrc, setFailedSrc] = useState(null)

  // backend "/uploads/avatars/..." deta hai — browser "/api/..." se maangta hai (Vite proxy API key lagata hai)
  const src = user.avatar ? `/api${user.avatar}` : null
  const showImage = src && src !== failedSrc
  const letter = (user.name || user.email)[0].toUpperCase()

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-white',
        sizes[size],
        className,
      )}
    >
      {showImage ? <img src={src} alt="" className="size-full object-cover" onError={() => setFailedSrc(src)} /> : letter}
    </span>
  )
}
