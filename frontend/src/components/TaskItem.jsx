// ek task ki line — checkbox (complete/pending) aur × (delete)
export default function TaskItem({ task, onToggle, onDelete, disabled }) {
  return (
    <li>
      <label className="task-label">
        <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} disabled={disabled} />
        <span className={task.completed ? 'done' : ''}>{task.title}</span>
      </label>
      <button
        className="delete"
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
