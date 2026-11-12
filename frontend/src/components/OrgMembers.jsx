// org ke members — invite form, members ki list (role dropdown, nikalna), pending invites, aur khud org chhodna
// har control role ke hisaab se; aakhri owner wala qaida context (mock "backend") 400 se rokta hai
import { useId, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useWorkspace } from '../hooks/useWorkspace'
import { ClockIcon, LogOutIcon, MailIcon, TrashIcon } from '../ui/icons'
import { badge, button, cn, input, label, panel, titleText } from '../ui/styles'
import { memberEmail, memberName } from '../workspace/members'
import { ME_ID } from '../workspace/mockData'
import { assignableRoles, can, canManageMember, deniedReason, invitableRoles } from '../workspace/permissions'

// invite kitni der aur chalega — "41 ghante baqi"
function hoursLeft(expiresAt) {
  const hours = Math.round((new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000))
  return hours > 0 ? `${hours} ghante baqi` : 'expire ho gaya'
}

export default function OrgMembers({ onResult }) {
  const { user } = useAuth()
  const { activeOrg, role, invite, cancelInvite, changeRole, removeMember, leaveOrg } = useWorkspace()
  const roleOptions = invitableRoles(role)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const emailId = useId()
  const roleId = useId()
  const canInvite = can(role, 'member:invite')
  // preview badalne par chuna hua role ijazat se bahar ho sakta hai — tab pehla jaiz role
  const selectedInviteRole = roleOptions.includes(inviteRole) ? inviteRole : roleOptions[0]

  function handleInvite(e) {
    e.preventDefault()
    const result = invite(email, selectedInviteRole)
    onResult(result)
    if (result.ok) setEmail('')
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={panel}>
        <form onSubmit={handleInvite} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
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
              placeholder={canInvite ? 'naam@example.test' : `${role} invite nahi bhej sakta`}
              disabled={!canInvite}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={roleId} className={label}>
              Role
            </label>
            <select
              id={roleId}
              className={input}
              value={selectedInviteRole || ''}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={!canInvite}
            >
              {roleOptions.length === 0 && <option value="">—</option>}
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={button()} disabled={!canInvite || !email.trim()} title={canInvite ? undefined : deniedReason(role)}>
            <MailIcon />
            Invite
          </button>
        </form>
      </section>

      <section>
        <h2 className={cn(titleText, 'mb-3')}>Members ({activeOrg.members.length})</h2>
        <ul className={cn(panel, 'divide-y divide-border')}>
          {activeOrg.members.map((member) => {
            const isMe = member.userId === ME_ID
            const manageable = canManageMember(role, member.role)
            const options = manageable ? assignableRoles(role) : [member.role]
            const name = memberName(activeOrg, member.userId, user)
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-sm font-medium">
                  {name[0].toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted">{memberEmail(member, user)}</p>
                </div>
                {/* chaudai wrapper se — input khud w-full hai, us par doosri width nahi jodte */}
                <div className="w-28">
                  <select
                    className={input}
                    value={member.role}
                    onChange={(e) => onResult(changeRole(member, e.target.value))}
                    disabled={!manageable}
                    title={manageable ? undefined : deniedReason(role)}
                    aria-label={`${name} ka role`}
                  >
                    {/* dropdown mein maujooda role hamesha — chahe actor use assign na kar sake */}
                    {[...new Set([member.role, ...options])].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                {isMe ? (
                  <button type="button" className={button({ variant: 'secondary', size: 'sm' })} onClick={() => onResult(leaveOrg())}>
                    <LogOutIcon />
                    Chhodo
                  </button>
                ) : (
                  <button
                    type="button"
                    className={button({ variant: 'ghost', size: 'icon' })}
                    onClick={() => onResult(removeMember(member))}
                    disabled={!manageable}
                    title={manageable ? 'Nikaalo' : deniedReason(role)}
                    aria-label={`${name} ko nikaalo`}
                  >
                    <TrashIcon />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className={cn(titleText, 'mb-3')}>Pending invites ({activeOrg.invites.length})</h2>
        {activeOrg.invites.length === 0 ? (
          <p className="text-small text-muted">Koi pending invite nahi.</p>
        ) : (
          <ul className={cn(panel, 'divide-y divide-border')}>
            {activeOrg.invites.map((inv) => (
              <li key={inv.email} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <MailIcon className="size-4 text-muted" />
                <p className="min-w-0 flex-1 truncate text-sm">{inv.email}</p>
                <span className={badge}>{inv.role}</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <ClockIcon className="size-3.5" />
                  {hoursLeft(inv.expiresAt)}
                </span>
                <button
                  type="button"
                  className={button({ variant: 'ghost', size: 'sm' })}
                  onClick={() => onResult(cancelInvite(inv.email))}
                  disabled={!canInvite}
                  title={canInvite ? undefined : deniedReason(role)}
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
