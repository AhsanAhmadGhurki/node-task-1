// ek task ki line — checkbox (complete/pending) aur × (delete)
import { cn } from '../ui/styles'

export default function TaskItem({ task, onToggle, onDelete, disabled }) {
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
      <button
        className="cursor-pointer rounded-lg bg-transparent px-2.5 py-1 text-xl leading-none text-muted hover:enabled:bg-error-bg hover:enabled:text-error-text disabled:cursor-default disabled:opacity-60"
        onClick={() => onDelete(task)}
        disabled={disabled}
        aria-label={`Delete ${task.title}`}
        title="Delete"
      >
        ×
      </button>
    </li>
  )
}
