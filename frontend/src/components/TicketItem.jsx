// ek ticket — title, waqt, description aur attachments (click = download)
import { button, cn, muted } from '../ui/styles'
import { formatBytes } from '../utils/helpers'

export default function TicketItem({ ticket, onDownload, disabled }) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-border py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        {/* wrap-anywhere — lamba shabd (bina space) bhi toote, warna page side mein scroll */}
        <strong className="min-w-0 wrap-anywhere">{ticket.title}</strong>
        <span className="shrink-0 text-xs text-muted">{new Date(ticket.createdAt).toLocaleString()}</span>
      </div>
      {/* whitespace-pre-wrap — user ki likhi nayi lines waisi hi dikhen */}
      <p className={cn(muted, 'whitespace-pre-wrap wrap-anywhere')}>{ticket.description}</p>
      {ticket.attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {ticket.attachments.map((attachment) => (
            <li key={attachment._id} className="min-w-0 max-w-full">
              <button
                type="button"
                className={cn(button({ variant: 'secondary', size: 'sm', weight: 'medium' }), 'flex max-w-full items-center gap-1.5')}
                onClick={() => onDownload(ticket, attachment)}
                disabled={disabled}
                title={`Download ${attachment.originalName}`}
              >
                <span className="min-w-0 truncate">{attachment.originalName}</span>
                <span className="shrink-0 text-xs text-muted">{formatBytes(attachment.size)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
