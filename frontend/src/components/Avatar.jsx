// gol tasveer — sirf dikhati hai (click/upload nahi); tasveer na ho (ya load na ho) to naam (ya email) ka pehla harf
import { useAuth } from '../hooks/useAuth'
import { useFileUrl } from '../hooks/useFileUrl'
import { cn } from '../ui/styles'

// sirf naap aur harf ka size — ring/saaya nahi (sajawat; border hi kaafi)
const sizes = {
  sm: 'size-8 text-sm',
  lg: 'size-16 text-2xl',
}

export default function Avatar({ size = 'sm', className }) {
  const { user } = useAuth()
  // user.avatar = fileId — <img> token nahi bhej sakta, is liye 10 minute ka signed link (useFileUrl); jab tak na aaye, harf
  const { url } = useFileUrl(user.avatar)
  const letter = (user.name || user.email)[0].toUpperCase()

  return (
    <span
      className={cn(
        // neutral — harf wala gola grey; navbar mein ek aur rangeen dabba nahi
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-subtle font-medium text-text',
        sizes[size],
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : letter}
    </span>
  )
}
