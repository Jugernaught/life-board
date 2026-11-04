/** "Pick a date" dialog. Desktop renders a modal; the iPhone app renders a sheet (MobileDatePromptHost). */
import { useState } from 'react'
import { create } from 'zustand'
import { Button } from './Button'
import { Input } from './inputs'
import { Modal } from './Modal'

export interface DatePromptOptions {
  title?: string
  initial?: string
  /** Earliest date offered (defaults to none). */
  min?: string
}

interface DatePromptState {
  request?: DatePromptOptions & { resolve: (date: string | null) => void }
  open: (o: DatePromptOptions) => Promise<string | null>
  close: (date: string | null) => void
}

export const useDatePromptStore = create<DatePromptState>((set, get) => ({
  request: undefined,
  open: (o) =>
    new Promise<string | null>((resolve) => {
      get().request?.resolve(null)
      set({ request: { ...o, resolve } })
    }),
  close: (date) => {
    get().request?.resolve(date)
    set({ request: undefined })
  },
}))

/** Ask for a date. Resolves with yyyy-MM-dd, or null if cancelled. */
export const promptDate = (o: DatePromptOptions = {}) => useDatePromptStore.getState().open(o)

export function DatePromptBody({ request, onDone, id }: { request: DatePromptOptions; onDone: (date: string | null) => void; id: string }) {
  const [value, setValue] = useState(request.initial ?? '')
  return (
    <form
      id={id}
      onSubmit={(e) => {
        e.preventDefault()
        if (value) onDone(value)
      }}
    >
      <label className="sr-only" htmlFor={`${id}-input`}>
        Date
      </label>
      <Input id={`${id}-input`} type="date" value={value} min={request.min} autoFocus onChange={(e) => setValue(e.target.value)} data-testid="date-prompt-input" />
    </form>
  )
}

export function DatePromptHost() {
  const { request, close } = useDatePromptStore()
  const id = 'date-prompt'
  return (
    <Modal
      open={!!request}
      onClose={() => close(null)}
      size="sm"
      title={request?.title ?? 'Pick a date'}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={id}>
            Set date
          </Button>
        </>
      }
    >
      {request && <DatePromptBody key={request.initial ?? ''} request={request} onDone={close} id={id} />}
    </Modal>
  )
}
