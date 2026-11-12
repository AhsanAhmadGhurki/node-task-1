// mujhe aaye invites (GET /invitations) — har org ke; yahin se accept/decline (email ka link kholne ki zaroorat nahi)
// accept ke baad orgs ki list reload aur us org par; Invitations ke "Received" tab aur khaali workspace dono mein
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { acceptReceivedInvitation, declineReceivedInvitation, listReceivedInvitations } from '../api/orgApi'
import { useAction } from '../hooks/useAction'
import { useWorkspace } from '../hooks/useWorkspace'
import { ClockIcon, InboxIcon } from '../ui/icons'
import { badge, button, cn, panel } from '../ui/styles'
import { toAlert } from '../utils/helpers'
import EmptyState from './EmptyState'
import Loader from './Loader'

function timeLeft(expiresAt) {
  const hours = Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000))
  return hours > 0 ? `${hours} ghante baqi` : 'thodi der baqi'
}

export default function ReceivedInvitations({ onResult }) {
  const { reload: reloadOrgs } = useWorkspace()
  const navigate = useNavigate()
  const { busy, run } = useAction(onResult)
  const [invitations, setInvitations] = useState(null)

  useEffect(() => {
    let cancelled = false
    listReceivedInvitations()
      .then((data) => {
        if (!cancelled) setInvitations(data.invitations)
      })
      .catch((err) => {
        if (!cancelled) onResult(toAlert(err))
      })
    return () => {
      cancelled = true
    }
  }, [onResult])

  const drop = (id) => setInvitations((current) => current.filter((inv) => inv._id !== id))

  // galti ke baad (expire/replaced/pehle se member) — server se taaza list, andaza nahi
  async function refresh() {
    try {
      setInvitations((await listReceivedInvitations()).invitations)
    } catch {
      // list na aaye to purani hi rehne do — galti Toast mein pehle hi dikh chuki
    }
  }

  async function handleAccept(inv) {
    const data = await run(() => acceptReceivedInvitation(inv._id), (d) => `"${d.org.name}" join kar li — role ${d.role}`)
    if (!data) {
      await refresh()
      return
    }
    drop(inv._id)
    await reloadOrgs()
    navigate(`/workspace/${data.org._id}/members`)
  }

  async function handleDecline(inv) {
    const done = await run(() => declineReceivedInvitation(inv._id), `"${inv.org.name}" ka invite decline`)
    if (done) drop(inv._id)
  }

  if (!invitations) return <Loader text="Invites load ho rahe hain…" rows={2} />
  if (invitations.length === 0) {
    return (
      <div className={panel}>
        <EmptyState icon={InboxIcon} title="Koi invite nahi aaya" text="Jab koi aap ko kisi org mein bulayega, woh yahan dikhega." />
      </div>
    )
  }

  return (
    <ul className={cn(panel, 'divide-y divide-border')}>
      {invitations.map((inv) => (
        <li key={inv._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{inv.org.name}</p>
            <p className="truncate text-xs text-muted">by {inv.invitedBy?.name || inv.invitedBy?.email || '—'}</p>
          </div>
          <span className={badge}>{inv.role}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ClockIcon className="size-3.5" />
            {timeLeft(inv.expiresAt)}
          </span>
          <div className="flex gap-1.5">
            <button type="button" className={button({ size: 'sm' })} onClick={() => handleAccept(inv)} disabled={busy}>
              Accept
            </button>
            <button type="button" className={button({ variant: 'ghost', size: 'sm' })} onClick={() => handleDecline(inv)} disabled={busy}>
              Decline
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
