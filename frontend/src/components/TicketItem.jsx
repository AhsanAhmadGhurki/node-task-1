// ek ticket ka card — title, kab bheja, description (lambi ho to "aur padhein") aur attachments (click = download)
import { useState } from 'react'
import { ClockIcon, DownloadIcon, FileIcon, ImageIcon, PaperclipIcon } from '../ui/icons'
import { cn, focusRing, panel } from '../ui/styles'
import { formatBytes, timeAgo } from '../utils/helpers'

// is se lambi description pehle 3 line tak — baaki "aur padhein" par
const LONG_DESCRIPTION = 180

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
              const Icon = attachment.mimetype === 'application/pdf' ? FileIcon : ImageIcon
              return (
                <li key={attachment._id} className="min-w-0 max-w-full">
                  <button
                    type="button"
                    className={cn(
                      'group/file flex max-w-full cursor-pointer items-center gap-2 rounded-xl border border-border bg-subtle py-1.5 pr-2.5 pl-2 text-sm transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50',
                      focusRing,
                    )}
                    onClick={() => onDownload(ticket, attachment)}
                    disabled={disabled}
                    title={`Download ${attachment.originalName}`}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card text-primary-text">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 truncate">{attachment.originalName}</span>
                    <span className="shrink-0 text-xs text-muted">{formatBytes(attachment.size)}</span>
                    <DownloadIcon className="size-4 shrink-0 text-muted transition group-hover/file:text-primary-text" />
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
