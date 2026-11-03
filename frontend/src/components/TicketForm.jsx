// naya support ticket — title, description aur 0–3 files; parent (Tickets page) asal API call karta hai
import { useEffect, useId, useRef, useState } from 'react'
import { FileIcon, UploadIcon, XIcon } from '../ui/icons'
import { button, cn, field, focusRing, form, hint, hintText, input, inputBase, label } from '../ui/styles'
import {
  ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TOTAL_ATTACHMENT_BYTES,
  TICKET_TITLE_MAX_LENGTH,
  TICKET_TITLE_MIN_LENGTH,
  attachmentFileError,
  attachmentFilesError,
  formatBytes,
  totalBytes,
} from '../utils/helpers'

// ek hi file do baar (dobara chuni ya drop ki) — naam, size aur waqt teeno same
const sameFile = (a, b) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified

// onCreate({ title, description, files }) true lautaye to form khaali (fail par user ka likha aur chuni files na mitein)
// progress — upload chal raha ho to 0–100, warna null
export default function TicketForm({ onCreate, disabled, progress }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // { id, file, preview } — preview: image ka object URL (PDF ka null); event handler mein banta hai, effect mein nahi
  const [entries, setEntries] = useState([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  // page band ho to bache hue preview URLs chhod do (warna memory mein padi rehti hain)
  // ref effect mein update — render ke dauran ref chhoona React ka rule todta hai
  const entriesRef = useRef(entries)
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  useEffect(() => () => entriesRef.current.forEach((entry) => entry.preview && URL.revokeObjectURL(entry.preview)), [])

  const files = entries.map((entry) => entry.file)
  // backend jaise rules — 4th file chupke se chhodi nahi jaati, error dikhta hai aur submit band
  const filesError = attachmentFilesError(files)
  const total = totalBytes(files)
  const full = files.length >= MAX_ATTACHMENTS

  // chuni ya drop ki hui files — pehle wali ke saath jodo, dobara wali chhod do
  function addFiles(list) {
    const picked = Array.from(list).filter((file) => !entries.some((entry) => sameFile(entry.file, file)))
    const added = picked.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: file.type.startsWith('image/') && ATTACHMENT_TYPES.includes(file.type) ? URL.createObjectURL(file) : null,
    }))
    setEntries((current) => [...current, ...added])
  }

  function handlePick(e) {
    addFiles(e.target.files)
    // input khaali karo — warna wahi file dobara chunne par onChange nahi chalta
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (!disabled && !full) addFiles(e.dataTransfer.files)
  }

  function removeEntry(id) {
    const entry = entries.find((item) => item.id === id)
    if (entry?.preview) URL.revokeObjectURL(entry.preview)
    setEntries((current) => current.filter((item) => item.id !== id))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const created = await onCreate({ title, description, files })
    if (created) {
      entries.forEach((entry) => entry.preview && URL.revokeObjectURL(entry.preview))
      setTitle('')
      setDescription('')
      setEntries([])
    }
  }

  const empty = title.trim() === '' || description.trim() === ''
  // backend jaisa — trim ke baad 5 se chhota title bhejne ka faida nahi, 400 hi aata
  const titleTooShort = title.trim() !== '' && title.trim().length < TICKET_TITLE_MIN_LENGTH
  const uploading = progress !== null && progress !== undefined

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
          maxLength={TICKET_TITLE_MAX_LENGTH}
        />
        <span className="flex justify-between gap-2">
          <span className={cn(hintText, 'text-error-text')}>
            {titleTooShort && `Kam se kam ${TICKET_TITLE_MIN_LENGTH} characters`}
          </span>
          <span className={cn(hintText, title.length >= TICKET_TITLE_MAX_LENGTH - 10 ? 'text-error-text' : 'text-muted')}>
            {title.length}/{TICKET_TITLE_MAX_LENGTH}
          </span>
        </span>
      </div>

      <div className={field}>
        <label className={label} htmlFor={descriptionId}>
          Description
        </label>
        <textarea
          id={descriptionId}
          className={cn(inputBase, 'min-h-24 resize-y px-3 py-2 text-sm')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kya hua, kab hua, kya expect kiya tha…"
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        <span
          className={cn(hintText, 'self-end', description.length >= MAX_DESCRIPTION_LENGTH - 50 ? 'text-error-text' : 'text-muted')}
        >
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </span>
      </div>

      <div className={field}>
        <span className={label}>Attachments (optional)</span>
        {/* asli input chhupa — drop zone (click bhi) se khulta hai, taake chuni files ki list hum khud dikhayein */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ATTACHMENT_TYPES.join(',')}
          className="hidden"
          onChange={handlePick}
          aria-label="Choose attachments"
        />
        <button
          type="button"
          className={cn(
            'flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            focusRing,
            dragging
              ? 'border-primary bg-primary-soft text-text'
              : 'border-input bg-card text-muted hover:enabled:border-primary hover:enabled:bg-subtle/50',
          )}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!dragging) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={disabled || full}
        >
          <UploadIcon className="size-4 text-muted" />
          <span className="font-medium text-text">
            {full ? `${MAX_ATTACHMENTS} files ho gayin` : 'Files yahan chhodein ya click karke chunein'}
          </span>
          <span className={hintText}>JPEG, PNG, WebP ya PDF · har file 2 MB tak</span>
        </button>

        {/* kitni jagah bachi — files ki ginti aur MB, had paar ho to laal; patli patti, taake optional field par zyada nazar na jaye */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className={cn(hintText, files.length > MAX_ATTACHMENTS ? 'text-error-text' : 'text-muted')}>
              {files.length}/{MAX_ATTACHMENTS} files
            </span>
            <span className={cn(hintText, total > MAX_TOTAL_ATTACHMENT_BYTES ? 'text-error-text' : 'text-muted')}>
              {formatBytes(total)} / 5 MB
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <div
              className={cn('h-full rounded-full', total > MAX_TOTAL_ATTACHMENT_BYTES ? 'bg-error-text' : 'bg-primary')}
              style={{ width: `${Math.min(100, (total / MAX_TOTAL_ATTACHMENT_BYTES) * 100)}%` }}
            />
          </div>
        </div>

        {entries.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {entries.map(({ id, file, preview }) => {
              const problem = attachmentFileError(file)
              return (
                <li
                  key={id}
                  className={cn(
                    'flex items-center gap-3 rounded-md border py-1.5 pr-1.5 pl-2 text-sm',
                    problem ? 'border-error-text/40 bg-error-bg' : 'border-border bg-card',
                  )}
                >
                  {/* image ka chhota preview, PDF (ya galat file) par type ka label */}
                  {preview ? (
                    <img src={preview} alt="" className="size-8 shrink-0 rounded object-cover" />
                  ) : (
                    // PDF (ya galat file) — icon; asal type neeche size ke saath likha hai
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded bg-subtle text-muted"
                      title={file.type === 'application/pdf' ? 'PDF' : 'File'}
                    >
                      <FileIcon />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className={cn(hintText, problem ? 'text-error-text' : 'text-muted')}>
                      {file.type === 'application/pdf' && 'PDF · '}
                      {formatBytes(file.size)}
                      {problem && ` · ${problem}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={button({ variant: 'ghost', size: 'icon' })}
                    onClick={() => removeEntry(id)}
                    disabled={disabled}
                    aria-label={`Remove ${file.name}`}
                    title="Hatao"
                  >
                    <XIcon />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {filesError && (
          <span className={cn(hintText, 'text-error-text')} role="alert">
            {filesError}
          </span>
        )}
        {!filesError && entries.length === 0 && <span className={hint}>Sab files mila kar 5 MB tak</span>}
      </div>

      {/* upload ke dauran button par hi progress — 5 MB mein kuch second lag sakte hain */}
      <button
        type="submit"
        className={cn(button(), 'relative mt-2 w-full overflow-hidden')}
        disabled={disabled || empty || titleTooShort || Boolean(filesError)}
      >
        {uploading && (
          <span className="absolute inset-y-0 left-0 bg-primary-hover" style={{ width: `${progress}%` }} aria-hidden="true" />
        )}
        <span className="relative">{uploading ? `Bhej rahe hain… ${progress}%` : 'Ticket bhejo'}</span>
      </button>
    </form>
  )
}
