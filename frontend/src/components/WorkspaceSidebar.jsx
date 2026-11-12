// workspace page ki baayen patti — orgs ki list (har ek par aap ka role), nayi org, sections, aur role preview
// org badalte hi role badal jaata hai — dobara login ki zaroorat nahi
import { useId, useState } from 'react'
import { NavLink } from 'react-router'
import { useWorkspace } from '../hooks/useWorkspace'
import { LifeBuoyIcon, ListChecksIcon, PlusIcon, UsersIcon } from '../ui/icons'
import { badge, button, cn, focusRing, hint, input, panel } from '../ui/styles'
import { ME_ID } from '../workspace/mockData'
import { ROLES } from '../workspace/permissions'

const SECTIONS = [
  ['tasks', 'Tasks', ListChecksIcon],
  ['tickets', 'Tickets', LifeBuoyIcon],
  ['members', 'Members', UsersIcon],
]

const heading = 'px-2 pb-1.5 text-xs font-medium text-muted'
const row = cn('flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm no-underline transition-colors', focusRing)

export default function WorkspaceSidebar({ onResult }) {
  const { orgs, activeOrg, myRole, previewRole, selectOrg, setPreviewRole, createOrg } = useWorkspace()
  const [newName, setNewName] = useState(null)
  const previewId = useId()

  function handleCreate(e) {
    e.preventDefault()
    const result = createOrg(newName)
    onResult(result)
    if (result.ok) setNewName(null)
  }

  return (
    <aside className={cn(panel, 'flex flex-col gap-4 p-2 md:sticky md:top-20')}>
      <div>
        <p className={heading}>Workspaces</p>
        <ul className="flex flex-col gap-0.5">
          {orgs.map((org) => {
            const orgRole = org.members.find((m) => m.userId === ME_ID)?.role
            const active = org.id === activeOrg?.id
            return (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => selectOrg(org.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(row, active ? 'bg-subtle font-medium text-text' : 'text-muted hover:bg-subtle hover:text-text')}
                >
                  <span className="min-w-0 flex-1 truncate">{org.name}</span>
                  <span className={badge}>{orgRole}</span>
                </button>
              </li>
            )
          })}
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
              autoFocus
            />
            <div className="flex gap-1.5">
              <button type="submit" className={button({ size: 'sm' })}>
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
              <NavLink
                key={to}
                to={`/workspace/${to}`}
                className={({ isActive }) =>
                  cn(row, 'font-medium', isActive ? 'bg-subtle text-text' : 'text-muted hover:bg-subtle hover:text-text')
                }
              >
                <Icon />
                {text}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {activeOrg && (
        <div className="flex flex-col gap-1.5 border-t border-border px-2 pt-3 pb-1">
          <label htmlFor={previewId} className="text-xs font-medium text-muted">
            Role preview
          </label>
          <select
            id={previewId}
            className={input}
            value={previewRole || ''}
            onChange={(e) => setPreviewRole(e.target.value || null)}
          >
            <option value="">Asli role ({myRole})</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className={hint}>Sirf frontend par — dekhne ke liye ke har role ko kya milta hai.</p>
        </div>
      )}
    </aside>
  )
}
