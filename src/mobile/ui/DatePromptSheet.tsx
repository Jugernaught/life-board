import { DatePromptBody, useDatePromptStore } from '@/components/ui/datePrompt'
import { NavButton } from './Screen'
import { Sheet } from './Sheet'

/** iPhone version of promptDate(): a short sheet with the system date picker. */
export function MobileDatePromptHost() {
  const { request, close } = useDatePromptStore()
  const id = 'm-date-prompt'
  return (
    <Sheet
      open={!!request}
      onClose={() => close(null)}
      size="auto"
      title={request?.title ?? 'Pick a Date'}
      testId="date-prompt-sheet"
      leading={<NavButton onClick={() => close(null)}>Cancel</NavButton>}
      trailing={
        <button type="submit" form={id} className="ios-headline flex h-11 items-center px-3 text-accent active:opacity-50">
          Done
        </button>
      }
    >
      <div className="px-4 pt-2 pb-6">{request && <DatePromptBody key={request.initial ?? ''} request={request} onDone={close} id={id} />}</div>
    </Sheet>
  )
}
