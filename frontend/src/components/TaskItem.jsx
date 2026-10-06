// ek task ki line — checkbox (complete/pending), ✎ (title edit) aur × (delete)
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

  if (draft !== null) {
    return (
      <li className="border-b border-border py-2.5">
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
    <li className="flex items-center justify-between gap-3 border-b border-border py-2.5">
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
          onClick={() => onDelete(task)}
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
