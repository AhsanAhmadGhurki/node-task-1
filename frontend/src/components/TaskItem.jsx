// ek task ki line — gol kone wala checkbox (complete/pending), pencil (title edit) aur trash (delete, do click)
import { useEffect, useId, useState } from 'react'
import { CheckIcon, PencilIcon, TrashIcon } from '../ui/icons'
import { button, cn, focusRing, hintText, input } from '../ui/styles'
import { MAX_TITLE_LENGTH } from '../utils/helpers'

// delete ka "pakka?" kitni der khula rahe — phir khud wapas trash icon
const CONFIRM_MS = 3000

// onRename(task, title) true lautaye to edit band (fail par user ka likha hua na mitey — TaskForm jaisa)
export default function TaskItem({ task, onToggle, onDelete, onRename, disabled }) {
  // null = edit band; string = input mein abhi wala title
  const [draft, setDraft] = useState(null)
  // pehla click — "Delete?" dikhao; doosra click — asal delete (galti se ek click mein task na jaye)
  const [confirming, setConfirming] = useState(false)
  const counterId = useId()

  // setState timer ke callback mein (effect mein seedha nahi)
  useEffect(() => {
    if (!confirming) return undefined
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS)
    return () => clearTimeout(timer)
  }, [confirming])

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

  function handleDelete() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    onDelete(task)
  }

  if (draft !== null) {
    return (
      <li className="bg-subtle/50 px-4 py-3 sm:px-5">
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
              {draft.length}/{MAX_TITLE_LENGTH} · Enter save, Esc cancel
            </span>
          </span>
          <button type="submit" className={button({ size: 'compact' })} disabled={disabled || draft.trim() === ''}>
            Save
          </button>
          <button
            type="button"
            className={button({ variant: 'ghost', size: 'compact', weight: 'medium' })}
            onClick={cancel}
            disabled={disabled}
          >
            Cancel
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-subtle/50 sm:px-5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-[15px]">
        {/* asli checkbox (keyboard, screen reader) — browser ka roop hata kar apna; tick icon peer-checked se */}
        <span className="relative flex size-5 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            className={cn(
              'peer m-0 size-5 cursor-pointer appearance-none rounded-md border-2 border-border bg-card transition checked:border-primary checked:bg-primary hover:enabled:border-primary disabled:cursor-default',
              focusRing,
            )}
            checked={task.completed}
            onChange={() => onToggle(task)}
            disabled={disabled}
          />
          <CheckIcon className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3.5} />
        </span>
        {/* wrap-anywhere — lamba shabd (bina space) bhi agli line mein, row bahar na nikle */}
        <span className={cn('wrap-anywhere transition', task.completed && 'text-muted line-through')}>{task.title}</span>
      </label>
      {/* mouse wale screen par hover/focus par hi dikhen (list saaf rahe); touch par hamesha; "Delete?" khula ho to bhi */}
      <span
        className={cn(
          'flex shrink-0 items-center gap-0.5 transition',
          !confirming && 'pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100',
        )}
      >
        {!confirming && (
          <button
            className={button({ variant: 'ghost', size: 'icon' })}
            onClick={() => setDraft(task.title)}
            disabled={disabled}
            aria-label={`Edit ${task.title}`}
            title="Edit"
          >
            <PencilIcon />
          </button>
        )}
        <button
          className={confirming ? button({ variant: 'danger', size: 'sm', weight: 'medium' }) : button({ variant: 'ghost', size: 'icon' })}
          onClick={handleDelete}
          disabled={disabled}
          aria-label={confirming ? `Pakka delete karein: ${task.title}` : `Delete ${task.title}`}
          title={confirming ? 'Dobara dabayen — delete' : 'Delete'}
        >
          <TrashIcon />
          {confirming && 'Delete?'}
        </button>
      </span>
    </li>
  )
}
