// naya task likhne ka form — parent (Dashboard) asal API call karta hai
import { useState } from 'react'
import { PlusIcon } from '../ui/icons'
import { button, cn, hintText, inputBase } from '../ui/styles'
import { MAX_TITLE_LENGTH } from '../utils/helpers'

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
    <form className="flex items-start gap-2" onSubmit={handleSubmit}>
      {/* input + uske neeche counter — button ke barabar jagah le */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="relative">
          <PlusIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            className={cn(inputBase, 'py-2.5 pr-3.5 pl-10')}
            name="title"
            placeholder="Naya task likhein…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New task title"
            aria-describedby="title-counter"
            // zyada type (ya paste) hi na ho
            maxLength={MAX_TITLE_LENGTH}
          />
        </span>
        {/* likhna shuru ho tabhi — had ke qareeb aane par rang badalta hai */}
        <span
          id="title-counter"
          className={cn(
            hintText,
            'self-end',
            title.length === 0 && 'sr-only',
            title.length >= MAX_TITLE_LENGTH - 20 ? 'text-error-text' : 'text-muted',
          )}
        >
          {title.length}/{MAX_TITLE_LENGTH}
        </span>
      </span>
      <button type="submit" className={button({ size: 'compact' })} disabled={disabled || title.trim() === ''}>
        <span className="max-sm:hidden">Add task</span>
        <PlusIcon className="size-4 sm:hidden" />
        <span className="sr-only sm:hidden">Add task</span>
      </button>
    </form>
  )
}
