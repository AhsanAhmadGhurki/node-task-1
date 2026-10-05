// naya task likhne ka form — parent (Dashboard) asal API call karta hai
import { useState } from 'react'
import { button, cn, hintText, input } from '../ui/styles'

// backend ki had — trim ke baad 200 (middleware/validation.js titleError)
const MAX_TITLE_LENGTH = 200

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
    <form className="mt-[18px] flex items-start gap-2" onSubmit={handleSubmit}>
      {/* input + uske neeche counter — button ke barabar jagah le */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          className={input}
          name="title"
          placeholder="Naya task likhein…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="New task title"
          aria-describedby="title-counter"
          // zyada type (ya paste) hi na ho
          maxLength={MAX_TITLE_LENGTH}
        />
        {/* had ke qareeb aane par rang badalta hai — kitna bacha nazar aaye */}
        <span id="title-counter" className={cn(hintText, 'self-end', title.length >= MAX_TITLE_LENGTH - 20 ? 'text-error-text' : 'text-muted')}>
          {title.length}/{MAX_TITLE_LENGTH}
        </span>
      </span>
      <button type="submit" className={button()} disabled={disabled || title.trim() === ''}>
        Add
      </button>
    </form>
  )
}
