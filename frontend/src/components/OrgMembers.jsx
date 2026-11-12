// org ke asli members (GET /orgs/:orgId/members) — role badalna, nikalna, khud chhodna
// button mera role dekh kar band/khula; aakhri owner jaise qaide backend lagata hai (400 Toast mein)
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { changeRole, leaveOrg, listMembers, removeMember } from '../api/orgApi'
import { useAction } from '../hooks/useAction'
import { useAuth } from '../hooks/useAuth'
import { useWorkspace } from '../hooks/useWorkspace'
import { LogOutIcon, TrashIcon, UsersIcon } from '../ui/icons'
import { badge, button, cn, input, panel } from '../ui/styles'
import { toAlert } from '../utils/helpers'
import { ROLES, assignableRoles, canManageMember, deniedReason } from '../workspace/permissions'
import EmptyState from './EmptyState'
import Loader from './Loader'

// "pakka?" ka button kitni der khula rahe (TaskItem jaisa)
const CONFIRM_MS = 3000

export default function OrgMembers({ org, onResult }) {
  const { user } = useAuth()
  const { reload: reloadOrgs } = useWorkspace()
  const navigate = useNavigate()
  const { busy, run } = useAction(onResult)
  const [members, setMembers] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const myRole = org.role

  // pehli load — sirf .then mein setState
  useEffect(() => {
    let cancelled = false
    listMembers(org._id)
      .then((data) => {
        if (!cancelled) setMembers(data.members)
      })
      .catch((err) => {
        if (!cancelled) onResult(toAlert(err))
      })
    return () => {
      cancelled = true
    }
  }, [org._id, onResult])

  useEffect(() => {
    if (!confirming) return undefined
    const timer = setTimeout(() => setConfirming(null), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [confirming])

  const refresh = useCallback(async () => {
    const data = await listMembers(org._id)
    setMembers(data.members)
  }, [org._id])

  async function handleRole(member, role) {
    const done = await run(() => changeRole(org._id, member.user._id, role), `${member.user.name || member.user.email} ab ${role} hai`)
    if (!done) return
    await refresh()
    // apna role badla (owner ne khud ko demote kiya) — sidebar aur buttons naye role se
    if (member.user._id === user._id) await reloadOrgs()
  }

  async function handleRemove(member) {
    if (confirming !== member.user._id) {
      setConfirming(member.user._id)
      return
    }
    setConfirming(null)
    const done = await run(() => removeMember(org._id, member.user._id), 'Member nikaal diya')
    if (done) await refresh()
  }

  async function handleLeave() {
    if (confirming !== 'leave') {
      setConfirming('leave')
      return
    }
    setConfirming(null)
    const done = await run(() => leaveOrg(org._id), `"${org.name}" chhod di`)
    if (!done) return
    await reloadOrgs()
    navigate('/workspace', { replace: true })
  }

  if (!members) return <Loader text="Members load ho rahe hain…" />
  if (members.length === 0) {
    return (
      <div className={panel}>
        <EmptyState icon={UsersIcon} title="Koi member nahi" />
      </div>
    )
  }

  return (
    <section>
      <ul className={cn(panel, 'divide-y divide-border')}>
        {members.map((member) => {
          const isMe = member.user._id === user._id
          const manageable = canManageMember(myRole, member.role)
          // ROLES ki tarteeb (owner → viewer) — maujooda role hamesha, baaki jo main de sakta hoon
          const assignable = manageable ? assignableRoles(myRole) : []
          const options = ROLES.filter((r) => r === member.role || assignable.includes(r))
          const name = member.user.name || member.user.email
          return (
            <li key={member.user._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-sm font-medium">
                {name[0].toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {isMe && <span className="font-normal text-muted"> (aap)</span>}
                </p>
                <p className="truncate text-xs text-muted">{member.user.email}</p>
              </div>

              {manageable ? (
                // chaudai wrapper se — input khud w-full hai
                <div className="w-28">
                  <select
                    className={input}
                    value={member.role}
                    onChange={(e) => handleRole(member, e.target.value)}
                    disabled={busy}
                    aria-label={`${name} ka role`}
                  >
                    {options.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className={badge} title={isMe ? undefined : deniedReason(myRole)}>
                  {member.role}
                </span>
              )}

              {isMe ? (
                <button type="button" className={button({ variant: 'secondary', size: 'sm' })} onClick={handleLeave} disabled={busy}>
                  <LogOutIcon />
                  {confirming === 'leave' ? 'Pakka chhodna?' : 'Chhodo'}
                </button>
              ) : (
                manageable && (
                  <button
                    type="button"
                    className={button({ variant: confirming === member.user._id ? 'danger' : 'ghost', size: confirming === member.user._id ? 'sm' : 'icon' })}
                    onClick={() => handleRemove(member)}
                    disabled={busy}
                    aria-label={`${name} ko nikaalo`}
                    title="Nikaalo"
                  >
                    {confirming === member.user._id ? 'Nikaalna?' : <TrashIcon />}
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
