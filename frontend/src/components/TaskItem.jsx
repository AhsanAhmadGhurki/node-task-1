// ek task ki line — checkbox (complete/pending), ✎ (title edit) aur × (delete, pehle "Delete karein?")
import { useId, useState } from 'react'
import { button, cn, hintText, input } from '../ui/styles'
import { MAX_TITLE_LENGTH } from '../utils/helpers'

// chhote icon buttons (✎, ×) ka ek hi roop — hover ka rang alag
const iconButton =
  'cursor-pointer rounded-lg bg-transparent px-2.5 py-1 text-xl leading-none text-muted disabled:cursor-default disabled:opacity-60'

// onRename(task, title) true lautaye to edit band (fail par user ka likha hua na mitey — TaskForm jaisa)
export default function TaskItem({ task, onToggle, onDelete, onRename, disabled }) {
  // null = edit band; string = input mein abhi wala title
  const [draft, setDraft] = useState(null)
  // × dabane par foran delete nahi — wapas na aane wala kaam, pehle wahin poocho
  const [confirming, setConfirming] = useState(false)
  const counterId = useId()

  function cancel() {
    setDraft(null)
  }

  async function handleSave(e) {
    e.preventDefault()
    // kuch badla hi nahi — request bhejne ki zaroorat nahi
    if (draft.trim() === task.title) {
      cancel()
      return
    }
    if (await onRename(task, draft)) {
      cancel()
    }
  }

  // har mode ke <li> ki alag key — warna React × wala button hi "Haan, delete" bana deta (focus usi par
  // reh jaata, autoFocus nahi lagta) aur × ke baad Enter foran delete kar deta
  if (confirming) {
    return (
      <li key="confirm" className="flex items-center justify-between gap-3 border-b border-border py-2.5">
        <span className="min-w-0 flex-1 text-[15px] wrap-anywhere">
          Delete karein: <strong>{task.title}</strong>?
        </span>
        <span className="flex shrink-0 gap-2">
          {/* focus "Nahi" par — Enter galti se dabe to bhi kuch na mitey; Esc bhi wapas */}
          <button
            className={button({ variant: 'secondary', size: 'sm' })}
            onClick={() => setConfirming(false)}
            onKeyDown={(e) => e.key === 'Escape' && setConfirming(false)}
            disabled={disabled}
            autoFocus
          >
            Nahi
          </button>
          <button className={button({ variant: 'danger', size: 'sm' })} onClick={() => onDelete(task)} disabled={disabled}>
            Haan, delete
          </button>
        </span>
      </li>
    )
  }

  if (draft !== null) {
    return (
      <li key="edit" className="border-b border-border py-2.5">
        <form className="flex items-start gap-2" onSubmit={handleSave}>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              className={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              // Esc — bina save kiye wapas
              onKeyDown={(e) => e.key === 'Escape' && cancel()}
              aria-label={`Edit title: ${task.title}`}
              aria-describedby={counterId}
              maxLength={MAX_TITLE_LENGTH}
              autoFocus
            />
            <span
              id={counterId}
              className={cn(hintText, 'self-end', draft.length >= MAX_TITLE_LENGTH - 20 ? 'text-error-text' : 'text-muted')}
            >
              {draft.length}/{MAX_TITLE_LENGTH}
            </span>
          </span>
          <button type="submit" className={button({ size: 'compact' })} disabled={disabled || draft.trim() === ''}>
            Save
          </button>
          <button type="button" className={button({ variant: 'secondary', size: 'compact' })} onClick={cancel} disabled={disabled}>
            Cancel
          </button>
        </form>
      </li>
    )
  }

  return (
    <li key="view" className="flex items-center justify-between gap-3 border-b border-border py-2.5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[15px] font-normal">
        <input
          type="checkbox"
          className="m-0 size-[18px] shrink-0 cursor-pointer accent-primary"
          checked={task.completed}
          onChange={() => onToggle(task)}
          disabled={disabled}
        />
        {/* wrap-anywhere — lamba shabd (bina space) bhi agli line mein, row bahar na nikle */}
        <span className={cn('wrap-anywhere', task.completed && 'text-muted line-through')}>{task.title}</span>
      </label>
      <span className="flex shrink-0">
        <button
          className={cn(iconButton, 'hover:enabled:bg-bg hover:enabled:text-text')}
          onClick={() => setDraft(task.title)}
          disabled={disabled}
          aria-label={`Edit ${task.title}`}
          title="Edit"
        >
          ✎
        </button>
        <button
          className={cn(iconButton, 'hover:enabled:bg-error-bg hover:enabled:text-error-text')}
          onClick={() => setConfirming(true)}
          disabled={disabled}
          aria-label={`Delete ${task.title}`}
          title="Delete"
        >
          ×
        </button>
      </span>
    </li>
  )
}
