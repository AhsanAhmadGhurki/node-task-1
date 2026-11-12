// workspace page ki baayen patti — meri orgs (har ek par mera asli role), nayi org, aur chuni hui org ke sections
// org badalte hi URL (/workspace/:orgId/...) aur role badal jaate hain
import { useState } from 'react'
import { NavLink } from 'react-router'
import { useAction } from '../hooks/useAction'
import { useWorkspace } from '../hooks/useWorkspace'
import { MailIcon, PlusIcon, SettingsIcon, UsersIcon } from '../ui/icons'
import { badge, button, cn, focusRing, input, panel } from '../ui/styles'

const SECTIONS = [
  ['members', 'Members', UsersIcon],
  ['invitations', 'Invitations', MailIcon],
  ['settings', 'Settings', SettingsIcon],
]

const heading = 'px-2 pb-1.5 text-xs font-medium text-muted'
const row = cn('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm no-underline transition-colors', focusRing)
const rowState = ({ isActive }) => cn(row, isActive ? 'bg-subtle font-medium text-text' : 'text-muted hover:bg-subtle hover:text-text')

export default function WorkspaceSidebar({ orgId, section, onResult, onCreated }) {
  const { orgs, createOrg } = useWorkspace()
  const { busy, run } = useAction(onResult)
  const [newName, setNewName] = useState(null)
  const activeOrg = orgs?.find((org) => org._id === orgId)

  async function handleCreate(e) {
    e.preventDefault()
    const data = await run(() => createOrg(newName), (d) => `"${d.org.name}" ban gayi — aap owner hain`)
    if (data) {
      setNewName(null)
      onCreated(data.org._id)
    }
  }

  return (
    <aside className={cn(panel, 'flex flex-col gap-4 p-2 md:sticky md:top-20')}>
      <div>
        <p className={heading}>Workspaces</p>
        <ul className="flex flex-col gap-0.5">
          {(orgs || []).map((org) => (
            <li key={org._id}>
              {/* org badlo to wahi section khula rahe */}
              <NavLink to={`/workspace/${org._id}/${section || 'members'}`} className={() => rowState({ isActive: org._id === orgId })}>
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                <span className={badge}>{org.role}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {newName === null ? (
          <button type="button" className={cn(row, 'mt-0.5 text-muted hover:bg-subtle hover:text-text')} onClick={() => setNewName('')}>
            <PlusIcon />
            Nayi org
          </button>
        ) : (
          <form onSubmit={handleCreate} className="mt-1 flex flex-col gap-1.5 px-1">
            <input
              className={input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setNewName(null)}
              placeholder="Org ka naam"
              aria-label="Nayi org ka naam"
              maxLength={100}
              autoFocus
            />
            <div className="flex gap-1.5">
              <button type="submit" className={button({ size: 'sm' })} disabled={busy || newName.trim().length < 2}>
                Banao
              </button>
              <button type="button" className={button({ variant: 'ghost', size: 'sm' })} onClick={() => setNewName(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {activeOrg && (
        <nav aria-label="Workspace sections">
          <p className={heading}>{activeOrg.name}</p>
          <div className="flex flex-col gap-0.5">
            {SECTIONS.map(([to, text, Icon]) => (
              <NavLink key={to} to={`/workspace/${activeOrg._id}/${to}`} className={rowState}>
                <Icon />
                {text}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </aside>
  )
}
