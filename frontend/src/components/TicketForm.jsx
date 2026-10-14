// naya support ticket — title, description aur 0–3 files; parent (Tickets page) asal API call karta hai
import { useId, useRef, useState } from 'react'
import { button, cn, field, form, hint, hintText, input, label } from '../ui/styles'
import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  attachmentFilesError,
  formatBytes,
} from '../utils/helpers'

// onCreate({ title, description, files }) true lautaye to form khaali (fail par user ka likha aur chuni files na mitein)
export default function TicketForm({ onCreate, disabled }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const inputRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  // backend jaise rules — 4th file chupke se chhodi nahi jaati, error dikhta hai aur submit band
  const filesError = attachmentFilesError(files)

  function handleFiles(e) {
    const picked = Array.from(e.target.files)
    // input khaali karo — warna wahi file dobara chunne par onChange nahi chalta
    e.target.value = ''
    // pehle chuni hui files ke saath jodo — user ek ek kar ke bhi chun sake
    setFiles((current) => [...current, ...picked])
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const created = await onCreate({ title, description, files })
    if (created) {
      setTitle('')
      setDescription('')
      setFiles([])
    }
  }

  const empty = title.trim() === '' || description.trim() === ''

  return (
    <form className={form} onSubmit={handleSubmit}>
      <div className={field}>
        <label className={label} htmlFor={titleId}>
          Title
        </label>
        <input
          id={titleId}
          className={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masla ek line mein…"
          maxLength={MAX_TITLE_LENGTH}
        />
        <span className={cn(hintText, 'self-end', title.length >= MAX_TITLE_LENGTH - 20 ? 'text-error-text' : 'text-muted')}>
          {title.length}/{MAX_TITLE_LENGTH}
        </span>
      </div>

      <div className={field}>
        <label className={label} htmlFor={descriptionId}>
          Description
        </label>
        <textarea
          id={descriptionId}
          className={cn(input, 'min-h-24 resize-y')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kya hua, kab hua, kya expect kiya tha…"
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        <span
          className={cn(hintText, 'self-end', description.length >= MAX_DESCRIPTION_LENGTH - 100 ? 'text-error-text' : 'text-muted')}
        >
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </span>
      </div>

      <div className={field}>
        <span className={label}>Attachments (optional)</span>
        <span className={hint}>{MAX_ATTACHMENTS} files tak — JPEG, PNG, WebP ya PDF; har file 2 MB, sab mila kar 5 MB</span>
        {/* asli input chhupa — button se khulta hai, taake chuni files ki list hum khud dikhayein */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_TYPES.join(',')}
          className="hidden"
          onChange={handleFiles}
          aria-label="Choose attachments"
        />
        <button
          type="button"
          className={cn(button({ variant: 'secondary', size: 'sm', weight: 'medium' }), 'self-start')}
          onClick={() => inputRef.current.click()}
          disabled={disabled}
        >
          Files chuno
        </button>

        {files.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{file.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-muted hover:text-error-text"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {filesError && (
          <span className={cn(hintText, 'text-error-text')} role="alert">
            {filesError}
          </span>
        )}
      </div>

      <button type="submit" className={button()} disabled={disabled || empty || Boolean(filesError)}>
        Ticket bhejo
      </button>
    </form>
  )
}
