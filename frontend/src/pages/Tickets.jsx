// /tickets — support ticket bhejo (0–3 attachments) aur apne purane tickets dekho / attachments download karo
import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadFile } from '../api/fileApi'
import { createTicket, getTickets } from '../api/ticketApi'
import EmptyState from '../components/EmptyState'
import Loader from '../components/Loader'
import TicketForm from '../components/TicketForm'
import TicketItem from '../components/TicketItem'
import Toast from '../components/Toast'
import { InboxIcon } from '../ui/icons'
import { badge, card, cn, pageHeader, pageTitle, panel, subtitle, titleText } from '../ui/styles'
import { toAlert } from '../utils/helpers'

// kamyabi ka paigham itni der baad khud hat jaata hai — error rehta hai jab tak agla action na ho
const SUCCESS_ALERT_MS = 3000

export default function Tickets() {
  // null = abhi load nahi hua (Loader dikhao), [] = load ho gaya lekin khaali
  const [tickets, setTickets] = useState(null)
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)
  // upload kitna gaya (0–100) — sirf ticket bhejte waqt, warna null
  const [progress, setProgress] = useState(null)
  // Dashboard jaisa — ref foran badalta hai, ek tick mein do submit ho to bhi do tickets na banein
  const inFlight = useRef(false)

  // har action ka ek hi pattern — guard, purana paigham saaf, busy on, call, error ho to Alert
  const run = useCallback(async (action) => {
    if (inFlight.current) return null
    inFlight.current = true
    setAlert(null)
    setBusy(true)
    try {
      // download kuch nahi lautata — kamyabi ke liye true
      return (await action()) ?? true
    } catch (error) {
      setAlert(toAlert(error))
      return null
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!alert?.ok) return undefined
    const timer = setTimeout(() => setAlert(null), SUCCESS_ALERT_MS)
    return () => clearTimeout(timer)
  }, [alert])

  // page khulte hi tickets — state sirf jawab aane par; cancelled — page pehle band ho jaye to purana jawab na lage
  useEffect(() => {
    let cancelled = false
    getTickets()
      .then((data) => !cancelled && setTickets(data))
      .catch((error) => !cancelled && setAlert(toAlert(error)))
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(fields) {
    setProgress(0)
    const ticket = await run(() => createTicket(fields, setProgress))
    setProgress(null)
    if (!ticket) return false
    // naya sabse upar — backend bhi naye pehle deta hai
    setTickets((current) => [ticket, ...(current || [])])
    const count = ticket.attachments.length
    setAlert({ ok: true, status: 201, text: `Ticket bhej diya: ${ticket.title}${count ? ` (${count} attachment)` : ''}` })
    return true
  }

  // attachment._id = fileId — GET /files/:fileId?download=1 (403/404 ho to Toast)
  async function handleDownload(attachment) {
    await run(() => downloadFile(attachment._id, attachment.originalName))
  }

  return (
    <div>
      <div className={pageHeader}>
        <div className="min-w-0">
          <h1 className={pageTitle}>Support</h1>
          <p className={subtitle}>
            Masla batayein — screenshot ya PDF ke saath. Har ticket aur us ki files sirf aap dekh sakte hain.
          </p>
        </div>
      </div>

      {/* bade screen par do column — baayen form (scroll par saath rehta hai; navbar 56px + 24px jagah), daayen tickets */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className={cn(card, 'lg:sticky lg:top-20')}>
          <h2 className={titleText}>Naya ticket</h2>
          <p className={subtitle}>Hum jaldi jawab denge.</p>
          <div className="mt-5">
            <TicketForm onCreate={handleCreate} disabled={busy} progress={progress} />
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <h2 className={titleText}>Mere tickets</h2>
            {tickets?.length > 0 && <span className={badge}>{tickets.length}</span>}
          </div>
          {tickets === null ? (
            <div className={cn(panel, 'mt-3 p-4')}>
              <Loader text="Tickets load ho rahe hain…" />
            </div>
          ) : tickets.length === 0 ? (
            <div className={cn(panel, 'mt-3')}>
              <EmptyState icon={InboxIcon} title="Abhi koi ticket nahi" text="Form bhar kar apna pehla ticket bhejein." />
            </div>
          ) : (
            // ek panel, beech mein lakeerein — tasks ki list jaisa (pehle har ticket alag tairta card tha)
            <ul className={cn(panel, 'mt-3 divide-y divide-border')}>
              {tickets.map((ticket) => (
                <TicketItem key={ticket._id} ticket={ticket} onDownload={handleDownload} disabled={busy} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <Toast alert={alert} onClose={() => setAlert(null)} />
    </div>
  )
}
