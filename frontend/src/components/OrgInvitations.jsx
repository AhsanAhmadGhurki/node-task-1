// org ke asli invites — bhejna (owner/admin), pending list, cancel
// email ka link backend bhejta hai (SMTP na ho to backend console mein); development mein (EXPOSE_DEV_OTP) backend
// jawab mein devToken bhi deta hai — tab link yahin dikhta hai, taake bina email ke doosre account se khola ja sake
import { useCallback, useEffect, useId, useState } from 'react'
import { cancelInvitation, listInvitations, sendInvitation } from '../api/orgApi'
import { useAction } from '../hooks/useAction'
import { ClockIcon, MailIcon } from '../ui/icons'
import { badge, button, cn, focusRing, hint, input, label, link, panel } from '../ui/styles'
import { toAlert } from '../utils/helpers'
import { can, deniedReason, invitableRoles } from '../workspace/permissions'
import Loader from './Loader'
import ReceivedInvitations from './ReceivedInvitations'

function timeLeft(expiresAt) {
  const hours = Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000))
  return hours > 0 ? `${hours} ghante baqi` : 'expire ho gaya'
}

// do tab — Sent (is org se bheje) aur Received (mujhe aaye, har org ke); Dashboard ke filter jaisa segmented control
const TABS = [
  ['sent', 'Sent'],
  ['received', 'Received'],
]

export default function OrgInvitations({ org, onResult }) {
  const [tab, setTab] = useState('sent')

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit rounded-md bg-subtle p-0.5" role="group" aria-label="Invites">
        {TABS.map(([key, text]) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center rounded px-2.5 text-sm font-medium transition-colors',
              focusRing,
              // Dashboard ke filter jaisa — chuna hua safed satah aur patli line (saaya nahi)
              tab === key ? 'bg-card text-text ring-1 ring-border' : 'text-muted hover:text-text',
            )}
          >
            {text}
          </button>
        ))}
      </div>
      {tab === 'sent' ? <SentInvitations org={org} onResult={onResult} /> : <ReceivedInvitations onResult={onResult} />}
    </div>
  )
}

// is org se bheje gaye pending invites — bhejna (owner/admin), list, cancel
function SentInvitations({ org, onResult }) {
  const { busy, run } = useAction(onResult)
  const [invitations, setInvitations] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [devLink, setDevLink] = useState(null)
  const emailId = useId()
  const roleId = useId()
  const canInvite = can(org.role, 'member:invite')
  const roleOptions = invitableRoles(org.role)
  const selectedRole = roleOptions.includes(role) ? role : roleOptions[0]

  useEffect(() => {
    let cancelled = false
    listInvitations(org._id)
      .then((data) => {
        if (!cancelled) setInvitations(data.invitations)
      })
      .catch((err) => {
        if (!cancelled) onResult(toAlert(err))
      })
    return () => {
      cancelled = true
    }
  }, [org._id, onResult])

  const refresh = useCallback(async () => {
    const data = await listInvitations(org._id)
    setInvitations(data.invitations)
  }, [org._id])

  async function handleSend(e) {
    e.preventDefault()
    const data = await run(() => sendInvitation(org._id, email.trim(), selectedRole), (d) => d.message)
    if (!data) return
    setEmail('')
    setDevLink(data.devToken ? { email: data.invitation.email, url: `${window.location.origin}/invitations/${data.devToken}` } : null)
    await refresh()
  }

  async function handleCancel(inv) {
    const done = await run(() => cancelInvitation(org._id, inv._id), `${inv.email} ka invite cancel`)
    if (!done) return
    if (devLink?.email === inv.email) setDevLink(null)
    await refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={panel}>
        <form onSubmit={handleSend} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={emailId} className={label}>
              Email se invite
            </label>
            <input
              id={emailId}
              type="email"
              className={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={canInvite ? 'naam@example.com' : `${org.role} invite nahi bhej sakta`}
              disabled={!canInvite}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={roleId} className={label}>
              Role
            </label>
            <div className="w-28">
              <select id={roleId} className={input} value={selectedRole || ''} onChange={(e) => setRole(e.target.value)} disabled={!canInvite}>
                {roleOptions.length === 0 && <option value="">—</option>}
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className={button()} disabled={!canInvite || busy || !email.trim()} title={canInvite ? undefined : deniedReason(org.role)}>
            <MailIcon />
            Invite
          </button>
        </form>
        {devLink && (
          <div className="border-t border-border px-4 py-3">
            <p className={hint}>
              Development link ({devLink.email}) — email ke bina, us account se login kar ke kholein:
            </p>
            <a href={devLink.url} className={cn(link, 'text-xs break-all')}>
              {devLink.url}
            </a>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Sent — pending {invitations && `(${invitations.length})`}</h2>
        {!invitations ? (
          <Loader text="Invites load ho rahe hain…" rows={2} />
        ) : invitations.length === 0 ? (
          <p className="text-small text-muted">Koi pending invite nahi.</p>
        ) : (
          <ul className={cn(panel, 'divide-y divide-border')}>
            {invitations.map((inv) => (
              <li key={inv._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <MailIcon className="size-4 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{inv.email}</p>
                  <p className="truncate text-xs text-muted">by {inv.invitedBy?.name || inv.invitedBy?.email || '—'}</p>
                </div>
                <span className={badge}>{inv.role}</span>
                <span className={cn('inline-flex items-center gap-1 text-xs', inv.expired ? 'text-error-text' : 'text-muted')}>
                  <ClockIcon className="size-3.5" />
                  {timeLeft(inv.expiresAt)}
                </span>
                {canInvite && (
                  <button type="button" className={button({ variant: 'ghost', size: 'sm' })} onClick={() => handleCancel(inv)} disabled={busy}>
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
