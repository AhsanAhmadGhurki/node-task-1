// naya task likhne ka form — parent (Dashboard) asal API call karta hai
import { useState } from 'react'

// onAdd(title) true lautaye to input khaali kar do (fail par user ka likha hua na mitey)
export default function TaskForm({ onAdd, disabled }) {
  const [title, setTitle] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const added = await onAdd(title)
    if (added) {
      setTitle('')
    }
  }

  return (
    <form className="add-task" onSubmit={handleSubmit}>
      <input
        name="title"
        placeholder="Naya task likhein…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-label="New task title"
      />
      <button type="submit" disabled={disabled || title.trim() === ''}>Add</button>
    </form>
  )
}
