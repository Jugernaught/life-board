import { useState } from 'react'
import { Bell, Calendar, Database, Globe2, LayoutGrid, Lock, Palette, Plus, Smartphone, Target, Trash2, User, Wallet } from 'lucide-react'
import { DATE_FORMATS, formatDate, todayISO } from '@/lib/dates'
import { CURRENCIES } from '@/lib/format'
import { cn } from '@/lib/utils'
import { actions, useSettings } from '@/store/store'
import type { Settings } from '@/data/types'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, NumberInput, Segmented, Select, Switch } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { WeekdayPicker } from '@/components/ui/pickers'
import { Tabs, useTabParam } from '@/components/ui/Tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { DashboardLayoutEditor } from '@/features/command-centre/CustomiseDashboard'
import { AppearanceSettings } from './AppearanceSettings'
import { DataSettings } from './DataSettings'
import { NotificationSettings } from './NotificationSettings'

const TABS = [
  { id: 'general', label: 'General', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'targets', label: 'Targets', icon: Target },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'privacy', label: 'Privacy', icon: Lock },
  { id: 'data', label: 'Data & backups', icon: Database },
] as const

const set = (patch: Partial<Settings>) => actions.updateSettings(patch)

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[12.5px] text-ink-subtle">{description}</p>}
      </div>
      <div className="shrink-0 sm:min-w-64">{children}</div>
    </div>
  )
}

function CategoryEditor({ kind }: { kind: 'expenseCategories' | 'incomeCategories' }) {
  const settings = useSettings()
  const [text, setText] = useState('')
  const list = settings[kind]
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">
        {list.map((c) => (
          <li key={c} className="inline-flex items-center gap-1 rounded-md border border-line bg-panel-2/50 py-1 pr-1 pl-2.5 text-[12.5px] text-ink">
            {c}
            <IconButton icon={Trash2} label={`Remove ${c}`} size="xs" variant="danger" onClick={() => set({ [kind]: list.filter((x) => x !== c) } as Partial<Settings>)} disabled={list.length <= 1} />
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const t = text.trim()
          if (!t || list.some((c) => c.toLowerCase() === t.toLowerCase())) return
          set({ [kind]: [...list, t] } as Partial<Settings>)
          setText('')
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="New category" aria-label="New category" maxLength={60} />
        <Button type="submit" icon={Plus}>
          Add
        </Button>
      </form>
      <p className="mt-2 text-[12px] text-ink-subtle">Removing a category here doesn’t change existing transactions — it only removes the suggestion.</p>
    </div>
  )
}

function TargetInput({ field, label, description, unit, min, max }: { field: keyof Settings['targets']; label: string; description: string; unit: string; min: number; max: number }) {
  const settings = useSettings()
  const value = settings.targets[field] as number | undefined
  // A value outside the range isn't saved — and says so, instead of silently doing nothing.
  const [problem, setProblem] = useState<string | undefined>()
  const id = `target-${field}`
  return (
    <Row label={label} description={`${description} · ${min}–${max.toLocaleString()} ${unit.replace(/^\//, 'per ')}`}>
      <div>
        <NumberInput
          value={value}
          onChange={(v) => {
            if (v === undefined) {
              setProblem(undefined)
              set({ targets: { ...settings.targets, [field]: undefined } })
            } else if (!Number.isFinite(v)) setProblem('Enter a number')
            else if (v < min || v > max) setProblem(`Use a value from ${min} to ${max.toLocaleString()}`)
            else {
              setProblem(undefined)
              set({ targets: { ...settings.targets, [field]: Math.round(v * 10) / 10 } })
            }
          }}
          placeholder="Not set"
          aria-label={label}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-error` : undefined}
          invalid={!!problem}
          trailing={<span className="pr-1 text-[12px]">{unit}</span>}
        />
        {problem && (
          <p id={`${id}-error`} className="mt-1 text-[12px] text-bad" role="alert" data-testid="target-error">
            {problem}
          </p>
        )}
      </div>
    </Row>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const [tab, setTab] = useTabParam(TABS, 'general')
  return (
    <div>
      <PageHeader section="settings" description="Personalise LIFE OS and manage your data. Changes save instantly." />
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors', tab === t.id ? 'bg-accent/10 text-ink' : 'text-ink-muted hover:bg-panel-3/60 hover:text-ink')}
                >
                  <t.icon size={15} className={tab === t.id ? 'text-accent' : 'text-ink-subtle'} />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4 lg:hidden" />
          {tab === 'general' && (
            <Panel title="General" icon={Globe2}>
              <Row label="Display name" description="Used in your greeting">
                <Input value={s.displayName} onChange={(e) => set({ displayName: e.target.value.slice(0, 60) })} placeholder="Your name" aria-label="Display name" />
              </Row>
              <Row label="Currency" description="Used for all amounts. Existing amounts are not converted.">
                <Select value={s.currency} onChange={(e) => set({ currency: e.target.value })} aria-label="Currency">
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Row>
              <Row label="Date format">
                <Select value={s.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as Settings['dateFormat'] })} aria-label="Date format">
                  {DATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {formatDate(todayISO(), f)} ({f})
                    </option>
                  ))}
                </Select>
              </Row>
              <Row label="Time format">
                <Segmented value={s.timeFormat} onChange={(timeFormat) => set({ timeFormat })} fullWidth ariaLabel="Time format" options={[{ value: '24h', label: '24-hour' }, { value: '12h', label: '12-hour' }]} />
              </Row>
              <Row label="Week starts on">
                <Segmented value={String(s.weekStartsOn) as '0' | '1'} onChange={(v) => set({ weekStartsOn: Number(v) as 0 | 1 })} fullWidth ariaLabel="Week start" options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
              </Row>
              <Row label="iPhone version" description="A separate touch-first version for iPhone at /m/ — same data on the same device and browser. Open it in Safari on your iPhone, then Share → Add to Home Screen.">
                <a href={`${import.meta.env.BASE_URL}m/`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 text-[13px] text-ink hover:border-line-strong" data-testid="settings-open-mobile">
                  <Smartphone size={15} className="text-accent" aria-hidden />
                  Open iPhone version
                </a>
              </Row>
              <Row label="First-time setup" description="Walk through the setup screens again. Your data is not affected.">
                <Button onClick={() => set({ onboarded: false })}>Run setup again</Button>
              </Row>
            </Panel>
          )}
          {tab === 'appearance' && <AppearanceSettings />}
          {tab === 'notifications' && <NotificationSettings />}
          {tab === 'schedule' && (
            <Panel title="Schedule" icon={Calendar}>
              <Row label="Working hours" description="Shaded on the daily and weekly timeline">
                <div className="flex items-center gap-2">
                  <Input type="time" value={s.workStart} onChange={(e) => e.target.value && set({ workStart: e.target.value })} aria-label="Working hours start" />
                  <span className="text-ink-subtle">–</span>
                  <Input type="time" value={s.workEnd} onChange={(e) => e.target.value && set({ workEnd: e.target.value })} aria-label="Working hours end" />
                </div>
              </Row>
              <Row label="Working days">
                <WeekdayPicker value={s.workDays} onChange={(workDays) => set({ workDays })} weekStartsOn={s.weekStartsOn} />
              </Row>
              <Row label="Default calendar view">
                <Segmented value={s.defaultCalendarView} onChange={(defaultCalendarView) => set({ defaultCalendarView })} fullWidth ariaLabel="Default calendar view" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
              </Row>
            </Panel>
          )}
          {tab === 'dashboard' && (
            <Panel title="Command Centre widgets" icon={LayoutGrid}>
              <DashboardLayoutEditor />
            </Panel>
          )}
          {tab === 'targets' && (
            <Panel title="Personal targets" icon={Target}>
              <p className="pb-2 text-[13px] text-ink-muted">Optional. When set, Analytics and section overviews show your progress against them. Nothing is assumed if you leave them blank.</p>
              <TargetInput field="weeklyWorkouts" label="Workouts per week" description="Fitness consistency" unit="/wk" min={1} max={21} />
              <TargetInput field="weeklyLearningMinutes" label="Learning time per week" description="Study sessions" unit="min" min={1} max={10000} />
              <TargetInput field="sleepHours" label="Sleep per night" description="Shown as a line on sleep charts" unit="h" min={1} max={14} />
              <TargetInput field="dailySteps" label="Daily steps" description="Activity logs" unit="steps" min={1} max={100000} />
              <TargetInput field="yearlyReading" label="Books per year" description="Reading & Media" unit="books" min={1} max={1000} />
              <TargetInput field="weeklyJournalEntries" label="Journal entries per week" description="Reflection habit" unit="/wk" min={1} max={7} />
            </Panel>
          )}
          {tab === 'finance' && (
            <div className="space-y-4">
              <Panel title="Spending categories" icon={Wallet}>
                <CategoryEditor kind="expenseCategories" />
              </Panel>
              <Panel title="Income categories" icon={Wallet}>
                <CategoryEditor kind="incomeCategories" />
              </Panel>
            </div>
          )}
          {tab === 'privacy' && (
            <Panel title="Privacy" icon={Lock}>
              <Row label="Blur journal previews" description="Hide entry text in lists and highlights until you choose to reveal it — useful when others can see your screen. This is a visual screen-privacy feature, not encryption.">
                <Switch checked={s.journalBlur} onChange={(journalBlur) => set({ journalBlur })} label={<span className="sr-only">Blur journal previews</span>} />
              </Row>
              <Row label="Show reflection prompts" description="The five optional prompts under each journal entry">
                <Switch checked={s.journalPrompts} onChange={(journalPrompts) => set({ journalPrompts })} label={<span className="sr-only">Show reflection prompts</span>} />
              </Row>
              <div className="mt-2 rounded-lg border border-line bg-panel-2/40 p-4 text-[13px] text-ink-muted">
                <p className="font-medium text-ink">How your data is handled</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Everything is stored locally in this browser (IndexedDB). No account, no server, no analytics, no tracking.</li>
                  <li>Fonts are bundled with the app, so no third-party requests are made when you use it.</li>
                  <li>Anyone with access to this browser profile can open LIFE OS and read your data. Use your device’s lock screen and a separate browser profile if you share the device.</li>
                  <li>Backups you export are plain JSON files — store them somewhere private.</li>
                </ul>
                <p className="mt-3 font-medium text-ink">Not connected</p>
                <p className="mt-1" data-testid="not-connected-note">
                  Cloud sync, calendar sync (Google / Outlook), bank connections, push notifications to a closed app and fitness trackers would each need an outside service, so none is active. Everything is entered by
                  you and stays on this device. Reminders work while LIFE OS is open (Settings → Notifications); syncing is described in docs/SUPABASE.md.
                </p>
              </div>
            </Panel>
          )}
          {tab === 'data' && <DataSettings />}
        </div>
      </div>
    </div>
  )
}
