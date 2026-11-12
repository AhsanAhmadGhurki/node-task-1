// org ki settings — naam badalna (owner/admin), ownership transfer (owner, password dobara), org delete (owner)
// har section role se band/khula; asal faisla backend ka (403/400 Toast mein)
import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { deleteOrg, listMembers, renameOrg, transferOwnership } from '../api/orgApi'
import { useAction } from '../hooks/useAction'
import { useWorkspace } from '../hooks/useWorkspace'
import { button, cn, form, hint, input, label, muted, panel, sectionRow, titleText } from '../ui/styles'
import { toAlert } from '../utils/helpers'
import { can, deniedReason } from '../workspace/permissions'
import PasswordInput from './PasswordInput'

export default function OrgSettings({ org, onResult }) {
  const { reload: reloadOrgs } = useWorkspace()
  const navigate = useNavigate()
  const { busy, run } = useAction(onResult)
  const [name, setName] = useState(org.name)
  const [members, setMembers] = useState([])
  const [newOwnerId, setNewOwnerId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const nameId = useId()
  const ownerSelectId = useId()
  const confirmId = useId()
  const canRename = can(org.role, 'org:rename')
  const canTransfer = can(org.role, 'org:transfer')
  const canDelete = can(org.role, 'org:delete')

  // transfer ke liye members (jo pehle se owner nahi) — sirf owner ko chahiye
  useEffect(() => {
    if (!canTransfer) return undefined
    let cancelled = false
    listMembers(org._id)
      .then((data) => {
        if (!cancelled) setMembers(data.members.filter((m) => m.role !== 'owner'))
      })
      .catch((err) => {
        if (!cancelled) onResult(toAlert(err))
      })
    return () => {
      cancelled = true
    }
  }, [org._id, canTransfer, onResult])

  async function handleRename(e) {
    e.preventDefault()
    const done = await run(() => renameOrg(org._id, name), 'Naam badal gaya')
    if (done) await reloadOrgs()
  }

  async function handleTransfer(e) {
    e.preventDefault()
    const data = await run(
      () => transferOwnership(org._id, newOwnerId, password),
      (d) => `${d.newOwner.user.name || d.newOwner.user.email} ab owner hai — aap admin hain`,
    )
    // password kabhi state mein na rahe — kamyabi ho ya galti
    setPassword('')
    if (data) await reloadOrgs()
  }

  async function handleDelete(e) {
    e.preventDefault()
    const done = await run(() => deleteOrg(org._id), `"${org.name}" delete ho gayi`)
    if (!done) return
    await reloadOrgs()
    navigate('/workspace', { replace: true })
  }

  return (
    <div className={cn(panel, 'divide-y divide-border')}>
      <section className={sectionRow}>
        <div>
          <h2 className={titleText}>Naam</h2>
          <p className={hint}>Owner aur admin badal sakte hain.</p>
        </div>
        <form onSubmit={handleRename} className={form}>
          <label htmlFor={nameId} className={label}>
            Org ka naam
          </label>
          <input id={nameId} className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} disabled={!canRename} />
          <div>
            <button
              type="submit"
              className={button()}
              disabled={!canRename || busy || name.trim().length < 2 || name.trim() === org.name}
              title={canRename ? undefined : deniedReason(org.role)}
            >
              Save
            </button>
          </div>
        </form>
      </section>

      <section className={sectionRow}>
        <div>
          <h2 className={titleText}>Ownership transfer</h2>
          <p className={hint}>Sirf owner. Chuna hua member owner banega, aap admin ho jayenge.</p>
        </div>
        {canTransfer ? (
          members.length === 0 ? (
            <p className={muted}>Pehle kisi ko invite karein — transfer sirf maujooda member ko hota hai.</p>
          ) : (
            <form onSubmit={handleTransfer} className={form}>
              <label htmlFor={ownerSelectId} className={label}>
                Naya owner
              </label>
              <select id={ownerSelectId} className={input} value={newOwnerId} onChange={(e) => setNewOwnerId(e.target.value)}>
                <option value="">Member chunein…</option>
                {members.map((m) => (
                  <option key={m.user._id} value={m.user._id}>
                    {(m.user.name || m.user.email) + ` (${m.role})`}
                  </option>
                ))}
              </select>
              {/* PasswordInput onChange mein seedha value deta hai (event nahi) — Login jaisa */}
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" hint="Apna password dobara — 5 ghalat koshishon par account 15 minute band." />
              <div>
                <button type="submit" className={button()} disabled={busy || !newOwnerId || !password}>
                  Transfer
                </button>
              </div>
            </form>
          )
        ) : (
          <p className={muted}>{deniedReason(org.role)}.</p>
        )}
      </section>

      <section className={sectionRow}>
        <div>
          <h2 className={titleText}>Org delete</h2>
          <p className={hint}>Sirf owner. Saare members aur invites bhi mit jayenge — wapas nahi aata.</p>
        </div>
        {canDelete ? (
          <form onSubmit={handleDelete} className={form}>
            <label htmlFor={confirmId} className={label}>
              Pakka karne ke liye naam likhein: <span className="font-semibold">{org.name}</span>
            </label>
            <input id={confirmId} className={input} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
            <div>
              <button type="submit" className={button({ variant: 'danger' })} disabled={busy || confirmName !== org.name}>
                Delete org
              </button>
            </div>
          </form>
        ) : (
          <p className={muted}>{deniedReason(org.role)}.</p>
        )}
      </section>
    </div>
  )
}
