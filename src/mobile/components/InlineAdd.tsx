import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'

/** A list row that becomes a text field: type and press Return to add. */
export function InlineAdd({ placeholder, onAdd, testId }: { placeholder: string; onAdd: (text: string) => void; testId?: string }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const submit = () => {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }
  return (
    <form
      className="flex items-center gap-3 px-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <button type="button" aria-label={placeholder} onClick={() => input.current?.focus()} className="-m-2.5 flex size-11 shrink-0 items-center justify-center text-accent">
        <span className="flex size-[22px] items-center justify-center rounded-full bg-accent text-on-accent">
          <Plus size={15} strokeWidth={3} />
        </span>
      </button>
      <input
        ref={input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={submit}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="done"
        data-testid={testId}
        className="!min-h-11 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-subtle"
      />
    </form>
  )
}
