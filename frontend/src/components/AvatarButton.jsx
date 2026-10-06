// Navbar ki gol tasveer — click par file chuno, foran upload; tasveer na ho to email ka pehla harf
import { useEffect, useRef, useState } from 'react'
import { uploadAvatar } from '../api/userApi'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../ui/styles'
import { AVATAR_TYPES, avatarFileError, toAlert } from '../utils/helpers'

// galti ka paigham itni der baad khud hat jaata hai
const ERROR_MS = 4000

export default function AvatarButton() {
  const { user, updateUser } = useAuth()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  // jo src load na ho saka (file disk se mit gayi) — us par harf dikhao, toota icon nahi
  const [failedSrc, setFailedSrc] = useState(null)

  // backend "/uploads/avatars/..." deta hai — browser "/api/..." se maangta hai (Vite proxy API key lagata hai)
  const src = user.avatar ? `/api${user.avatar}` : null
  const showImage = src && src !== failedSrc

  useEffect(() => {
    if (!error) return undefined
    const timer = setTimeout(() => setError(null), ERROR_MS)
    return () => clearTimeout(timer)
  }, [error])

  async function handleChange(e) {
    const file = e.target.files[0]
    // input khaali karo — warna wahi file dobara chunne par onChange nahi chalta
    e.target.value = ''
    if (!file) return

    // backend jaisa check pehle hi — galat/badi file par request hi nahi
    const problem = avatarFileError(file)
    if (problem) {
      setError(problem)
      return
    }

    setError(null)
    setUploading(true)
    try {
      const { avatar } = await uploadAvatar(file)
      updateUser({ avatar })
    } catch (err) {
      setError(toAlert(err).text)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={cn(
          'flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-primary p-0 text-sm font-semibold text-white disabled:cursor-default',
          uploading && 'opacity-60',
        )}
        onClick={() => inputRef.current.click()}
        disabled={uploading}
        aria-label={uploading ? 'Avatar upload ho raha hai' : 'Avatar badlein'}
        title={uploading ? 'Upload ho raha hai…' : 'Avatar badlein (JPEG, PNG, WebP — 2 MB tak)'}
      >
        {showImage ? (
          <img src={src} alt="" className="size-full object-cover" onError={() => setFailedSrc(src)} />
        ) : (
          user.email[0].toUpperCase()
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={AVATAR_TYPES.join(',')}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      {/* navbar ke neeche tairta hai — layout nahi hilta */}
      {error && (
        <p
          role="alert"
          className="absolute top-full right-0 z-10 mt-2 w-max max-w-65 rounded-lg bg-error-bg px-3 py-2 text-xs text-error-text shadow-lg"
        >
          {error}
        </p>
      )}
    </div>
  )
}
