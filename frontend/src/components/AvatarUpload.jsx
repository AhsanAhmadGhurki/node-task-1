// profile page par badi tasveer + "Photo badlo" — file chuno, foran upload
import { useRef, useState } from 'react'
import { uploadAvatar } from '../api/userApi'
import { useAuth } from '../hooks/useAuth'
import { button, cn, hint, hintText } from '../ui/styles'
import { AVATAR_TYPES, avatarFileError, toAlert } from '../utils/helpers'
import Avatar from './Avatar'

export default function AvatarUpload() {
  const { updateUser } = useAuth()
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

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
      // session mein bhi — navbar ki tasveer foran badal jaati hai
      updateUser({ avatar })
    } catch (err) {
      setError(toAlert(err).text)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mb-5 flex items-center gap-4">
      <Avatar size="lg" className={cn(uploading && 'opacity-60')} />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <button
          type="button"
          className={button({ variant: 'secondary', size: 'sm', weight: 'medium' })}
          onClick={() => inputRef.current.click()}
          disabled={uploading}
        >
          {uploading ? 'Upload ho raha hai…' : 'Photo badlo'}
        </button>
        {error ? (
          <span className={cn(hintText, 'text-error-text')} role="alert">
            {error}
          </span>
        ) : (
          <span className={hint}>JPEG, PNG ya WebP — 2 MB tak</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={AVATAR_TYPES.join(',')}
        onChange={handleChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
