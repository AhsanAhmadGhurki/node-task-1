// /tickets — support ticket bhejo (0–3 attachments) aur apne purane tickets dekho / attachments download karo
import { useCallback, useEffect, useRef, useState } from 'react'
import { createTicket, downloadAttachment, getTickets } from '../api/ticketApi'
import Alert from '../components/Alert'
import Loader from '../components/Loader'
import TicketForm from '../components/TicketForm'
import TicketItem from '../components/TicketItem'
import { card, cn, muted, title, titleText } from '../ui/styles'
import { toAlert } from '../utils/helpers'

// kamyabi ka paigham itni der baad khud hat jaata hai — error rehta hai jab tak agla action na ho
const SUCCESS_ALERT_MS = 3000

export default function Tickets() {
  // null = abhi load nahi hua (Loader dikhao), [] = load ho gaya lekin khaali
  const [tickets, setTickets] = useState(null)
  const [alert, setAlert] = useState(null)
  const [busy, setBusy] = useState(false)
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
    const ticket = await run(() => createTicket(fields))
    if (!ticket) return false
    // naya sabse upar — backend bhi naye pehle deta hai
    setTickets((current) => [ticket, ...(current || [])])
    const count = ticket.attachments.length
    setAlert({ ok: true, status: 201, text: `Ticket bhej diya: ${ticket.title}${count ? ` (${count} attachment)` : ''}` })
    return true
  }

  async function handleDownload(ticket, attachment) {
    await run(() => downloadAttachment(ticket._id, attachment))
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <section className={card}>
        <h1 className={title}>Support ticket</h1>
        <Alert alert={alert} />
        <TicketForm onCreate={handleCreate} disabled={busy} />
      </section>

      <section className={card}>
        <h2 className={titleText}>Mere tickets</h2>
        {tickets === null ? (
          <Loader text="Tickets load ho rahe hain…" />
        ) : tickets.length === 0 ? (
          <p className={cn(muted, 'mt-[18px]')}>Abhi koi ticket nahi — upar se bhejein.</p>
        ) : (
          <ul className="mt-[18px] border-t border-border">
            {tickets.map((ticket) => (
              <TicketItem key={ticket._id} ticket={ticket} onDownload={handleDownload} disabled={busy} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
