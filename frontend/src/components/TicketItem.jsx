// ek ticket ka card — title, kab bheja, description (lambi ho to "aur padhein") aur attachments (download icon se)
import { useState } from 'react'
import { useFileUrl } from '../hooks/useFileUrl'
import { ClockIcon, DownloadIcon, FileIcon, ImageIcon, PaperclipIcon } from '../ui/icons'
import { cn, focusRing, panel } from '../ui/styles'
import { formatBytes, timeAgo } from '../utils/helpers'

// is se lambi description pehle 3 line tak — baaki "aur padhein" par
const LONG_DESCRIPTION = 180

// tasveer wali attachment ka chhota thumbnail — click par poori tasveer naye tab mein
// file GET /files/:fileId se token ke saath (blob URL); jab tak na aaye ya fail ho, tasveer ka icon
// PDF ka preview nahi — backend bhi PDF hamesha download karwata hai (PDF ke andar script/links)
function ImagePreview({ attachment }) {
  const { url } = useFileUrl(attachment._id)
  const box = 'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card text-primary-text'

  if (!url) {
    return (
      <span className={box}>
        <ImageIcon className="size-4" />
      </span>
    )
  }

  return (
    <button
      type="button"
      className={cn(box, 'cursor-pointer', focusRing)}
      // blob URL isi tab ka hai — naya tab bhi wahi tasveer dikhata hai, server se dobara nahi maangta
      onClick={() => window.open(url, '_blank', 'noopener')}
      aria-label={`Preview ${attachment.originalName}`}
      title={`Preview ${attachment.originalName}`}
    >
      <img src={url} alt="" className="size-full object-cover" />
    </button>
  )
}

export default function TicketItem({ ticket, onDownload, disabled }) {
  const [expanded, setExpanded] = useState(false)
  const long = ticket.description.length > LONG_DESCRIPTION

  return (
    <li className={cn(panel, 'p-5')}>
      <div className="flex items-start justify-between gap-3">
        {/* wrap-anywhere — lamba shabd (bina space) bhi toote, warna page side mein scroll */}
        <h3 className="min-w-0 font-semibold wrap-anywhere">{ticket.title}</h3>
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted"
          title={new Date(ticket.createdAt).toLocaleString()}
        >
          <ClockIcon className="size-3.5" />
          {timeAgo(ticket.createdAt)}
        </span>
      </div>
      <p className="mt-0.5 font-mono text-xs text-muted">#{ticket._id.slice(-6)}</p>

      {/* whitespace-pre-wrap — user ki likhi nayi lines waisi hi dikhen */}
      <p className={cn('mt-3 text-sm whitespace-pre-wrap text-muted wrap-anywhere', long && !expanded && 'line-clamp-3')}>
        {ticket.description}
      </p>
      {long && (
        <button
          type="button"
          className={cn('mt-1 cursor-pointer rounded text-sm font-medium text-primary-text hover:underline', focusRing)}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Kam dikhao' : 'Aur padhein'}
        </button>
      )}

      {ticket.attachments.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <PaperclipIcon className="size-3.5" />
            {ticket.attachments.length} attachment{ticket.attachments.length > 1 && 's'}
          </p>
          <ul className="flex flex-wrap gap-2">
            {ticket.attachments.map((attachment) => {
              return (
                <li
                  key={attachment._id}
                  className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border bg-subtle py-1.5 pr-1.5 pl-2 text-sm"
                >
                  {attachment.mimetype === 'application/pdf' ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card text-primary-text">
                      <FileIcon className="size-4" />
                    </span>
                  ) : (
                    <ImagePreview attachment={attachment} />
                  )}
                  <span className="min-w-0 truncate">{attachment.originalName}</span>
                  <span className="shrink-0 text-xs text-muted">{formatBytes(attachment.size)}</span>
                  {/* download sirf icon wale button se — poora chip click karne par nahi */}
                  <button
                    type="button"
                    className={cn(
                      'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-primary-text disabled:cursor-not-allowed disabled:opacity-50',
                      focusRing,
                    )}
                    onClick={() => onDownload(attachment)}
                    disabled={disabled}
                    aria-label={`Download ${attachment.originalName}`}
                    title={`Download ${attachment.originalName}`}
                  >
                    <DownloadIcon className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </li>
  )
}
