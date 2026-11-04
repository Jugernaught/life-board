import { Bell, BellOff, BellRing } from 'lucide-react'
import { REMINDER_LEAD_OPTIONS, leadLabel, permissionText, sendTestNotification, useNotificationPermission } from '@/app/reminders'
import { actions, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Select, Switch } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'

function Row({ label, description, children }: { label: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Settings → Notifications: turn reminders on, allow system notifications, choose what and when. */
export function NotificationSettings() {
  const s = useSettings()
  const r = s.reminders
  const { permission, request } = useNotificationPermission()
  const set = (patch: Partial<typeof r>) => actions.updateSettings({ reminders: { ...r, ...patch } })
  const turnOn = async (on: boolean) => {
    set({ enabled: on })
    if (on && permission === 'default') await request()
  }
  return (
    <div className="space-y-4">
      <Panel title="Reminders" icon={Bell}>
        <Row label="Remind me" description="A reminder shortly before tasks with a due time and calendar events.">
          <Switch checked={r.enabled} onChange={(on) => void turnOn(on)} label={<span className="sr-only">Remind me</span>} id="reminders-enabled" />
        </Row>
        {r.enabled && (
          <>
            <Row label="Tasks with a due time" description="You can also set a reminder on a single task when you edit it.">
              <Switch checked={r.tasks} onChange={(tasks) => set({ tasks })} label={<span className="sr-only">Tasks with a due time</span>} />
            </Row>
            <Row label="Calendar events" description="Events with a start time (not all-day ones).">
              <Switch checked={r.events} onChange={(events) => set({ events })} label={<span className="sr-only">Calendar events</span>} />
            </Row>
            <Row label="When">
              <Select value={String(r.lead)} onChange={(e) => set({ lead: Number(e.target.value) })} aria-label="When to remind" className="w-52">
                {REMINDER_LEAD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {leadLabel(m)}
                  </option>
                ))}
              </Select>
            </Row>
            <Row label="System notifications" description={permissionText(permission, false)}>
              <div className="flex gap-2">
                {permission === 'default' && (
                  <Button variant="primary" size="sm" icon={BellRing} onClick={() => void request()}>
                    Allow
                  </Button>
                )}
                <Button size="sm" onClick={() => void sendTestNotification()} data-testid="reminders-test">
                  Send a test
                </Button>
              </div>
            </Row>
          </>
        )}
      </Panel>
      <Panel title="How reminders work" icon={BellOff}>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-ink-muted">
          <li>Reminders run on this device while LIFE OS is open — in a browser tab (even in the background) or the Windows app.</li>
          <li>They can’t arrive while LIFE OS is fully closed. That needs a push server, and LIFE OS keeps your data on this device instead.</li>
          <li>If you open LIFE OS up to 15 minutes after a reminder was due, you’ll still see it once.</li>
          <li>On iPhone, add LIFE OS to your Home Screen (iOS 16.4+) and allow notifications in iPhone Settings for system alerts.</li>
        </ul>
      </Panel>
    </div>
  )
}
