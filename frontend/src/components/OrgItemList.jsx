// org ke tasks ya tickets — ek hi component (kind = 'tasks' | 'tickets'); har button role se on/off
// band button ka title wajah batata hai; click phir bhi ho jaye (preview badalte waqt) to context 403 lautata hai
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useWorkspace } from '../hooks/useWorkspace'
import { InboxIcon, PlusIcon, TrashIcon } from '../ui/icons'
import { button, cn, focusRing, input, panel } from '../ui/styles'
import { memberName } from '../workspace/members'
import { ME_ID } from '../workspace/mockData'
import { can, canEditItem, deniedReason } from '../workspace/permissions'
import EmptyState from './EmptyState'

// badge jaisa chip, lekin button — rang halat se (badge ka text-muted upar se nahi badalte)
const statusChip = cn(
  'inline-flex h-6 shrink-0 cursor-pointer items-center rounded-md bg-subtle px-1.5 text-xs font-medium transition-colors hover:enabled:text-text disabled:cursor-not-allowed disabled:opacity-60',
  focusRing,
)

const TEXT = {
  tasks: { one: 'task', placeholder: 'Naya task…', empty: 'Abhi koi task nahi', doneLabel: 'Done', openLabel: 'Pending' },
  tickets: { one: 'ticket', placeholder: 'Naya ticket…', empty: 'Abhi koi ticket nahi', doneLabel: 'Closed', openLabel: 'Open' },
}

export default function OrgItemList({ kind, onResult }) {
  const { user } = useAuth()
  const { activeOrg, role, addItem, toggleItem, deleteItem } = useWorkspace()
  const [title, setTitle] = useState('')
  const text = TEXT[kind]
  const items = activeOrg[kind]
  const canCreate = can(role, 'item:create')

  function handleAdd(e) {
    e.preventDefault()
    const result = addItem(kind, title)
    onResult(result)
    if (result.ok) setTitle('')
  }

  return (
    <div className={panel}>
      <form onSubmit={handleAdd} className="flex gap-2 border-b border-border p-3">
        <input
          className={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={canCreate ? text.placeholder : `${role} naya ${text.one} nahi bana sakta`}
          aria-label={`Naya ${text.one}`}
          disabled={!canCreate}
        />
        <button type="submit" className={button()} disabled={!canCreate || !title.trim()} title={canCreate ? undefined : deniedReason(role)}>
          <PlusIcon />
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={InboxIcon} title={text.empty} text={canCreate ? 'Upar se pehla banayein.' : undefined} />
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const editable = canEditItem(role, item, ME_ID)
            const reason = editable ? undefined : deniedReason(role)
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  className={cn(statusChip, item.done ? 'text-success-text' : 'text-muted')}
                  onClick={() => onResult(toggleItem(kind, item))}
                  disabled={!editable}
                  title={reason}
                  aria-label={`${item.title}: ${item.done ? text.doneLabel : text.openLabel} — badlein`}
                >
                  {item.done ? text.doneLabel : text.openLabel}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm wrap-anywhere', item.done && 'text-muted line-through')}>{item.title}</p>
                  <p className="text-xs text-muted">by {memberName(activeOrg, item.createdBy, user)}</p>
                </div>
                <button
                  type="button"
                  className={button({ variant: 'ghost', size: 'icon' })}
                  onClick={() => onResult(deleteItem(kind, item))}
                  disabled={!editable}
                  title={reason || 'Delete'}
                  aria-label={`Delete: ${item.title}`}
                >
                  <TrashIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
