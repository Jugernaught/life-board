import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellRing, ChevronsUpDown, Database, Download, FolderTree, RotateCcw, Share, Smartphone, Target, Trash2, Upload } from 'lucide-react'
import { THEMES, resolveAppearance, supportsLight, themeMeta } from '@/app/themes'
import { TEXT_SCALES } from '@/app/textScaleCss'
import { REMINDER_LEAD_OPTIONS, leadLabel, permissionText, sendTestNotification, useNotificationPermission } from '@/app/reminders'
import { useSystemDark } from '@/app/ThemeController'
import { COLLECTIONS } from '@/data/registry'
import { COLLECTION_KEYS } from '@/data/schema'
import type { Database as Db, Settings } from '@/data/types'
import { type ValidationResult, countRecords, makeBackupFile, totalRecords } from '@/data/validate'
import { type BackupMeta, requestPersistentStorage, storageEstimate } from '@/storage'
import { type ImportMode, applyImport, createBackup, deleteBackup, getBackup, inspectImportFile, listBackups, markExported, pruneAutoBackups, resetAllData, restoreBackup } from '@/store/backups'
import { actions, appStore, useApp, useDatabase, useSettings } from '@/store/store'
import { DATE_FORMATS, formatDate, todayISO } from '@/lib/dates'
import { CURRENCIES, formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { confirmAction } from '@/components/ui/confirm'
import { toast } from '@/components/ui/toast'
import { InlineAdd } from '../../components/InlineAdd'
import { PhoneThemePreview } from '../../components/PhoneThemePreview'
import { shareJsonFile } from '../../components/share'
import { nav } from '../../nav/navigator'
import { actionSheet } from '../../ui/ActionSheet'
import { IosSwitch, Segmented } from '../../ui/controls'
import { ActionCell, Cell, EmptyRow, Section } from '../../ui/List'
import { NavButton, Screen } from '../../ui/Screen'
import { Sheet } from '../../ui/Sheet'
import { SwipeRow } from '../../ui/SwipeRow'

const set = (patch: Partial<Settings>) => actions.updateSettings(patch)

const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

/** A grouped-list row with a control on the right. */
function Row({ label, sub, children, htmlFor }: { label: ReactNode; sub?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex min-h-11 items-center gap-3 px-4 py-1.5">
      <label htmlFor={htmlFor} className="min-w-0 flex-1 py-1">
        <span className="ios-body block text-ink">{label}</span>
        {sub && <span className="ios-footnote block text-ink-subtle">{sub}</span>}
      </label>
      {children}
    </div>
  )
}

/** iOS-style picker row: the native <select> covers the row, so a tap opens the system picker wheel. */
function SelectRow<T extends string>({ label, value, options, onChange, testId }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; testId?: string }) {
  const current = options.find((o) => o.value === value)?.label ?? value
  return (
    <div className="ios-press relative flex min-h-11 items-center gap-3 px-4">
      <span className="ios-body flex-1 text-ink">{label}</span>
      <span className="ios-body max-w-[55%] truncate text-ink-subtle">{current}</span>
      <ChevronsUpDown size={15} className="shrink-0 text-ink-subtle" aria-hidden />
      <select value={value} onChange={(e) => onChange(e.target.value as T)} aria-label={label} data-testid={testId} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const DAYS = [
  { v: 1, s: 'M', l: 'Monday' },
  { v: 2, s: 'T', l: 'Tuesday' },
  { v: 3, s: 'W', l: 'Wednesday' },
  { v: 4, s: 'T', l: 'Thursday' },
  { v: 5, s: 'F', l: 'Friday' },
  { v: 6, s: 'S', l: 'Saturday' },
  { v: 0, s: 'S', l: 'Sunday' },
]

export function SettingsScreen() {
  const s = useSettings()
  const live = resolveAppearance(s, s.mobileTheme, useSystemDark())
  const db = useDatabase()
  const [name, setName] = useState(s.displayName)
  useEffect(() => setName(s.displayName), [s.displayName])
  const days = s.weekStartsOn === 0 ? [DAYS[6], ...DAYS.slice(0, 6)] : DAYS
  const standalone = isStandalone()
  return (
    <Screen title="Settings" large testId="screen-settings">
      <Section footer="Used in your greeting.">
        <Row label="Name" htmlFor="m-settings-name">
          <input
            id="m-settings-name"
            value={name}
            maxLength={60}
            placeholder="Your name"
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== s.displayName && set({ displayName: name.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="min-w-0 flex-1 bg-transparent text-right text-ink-muted outline-none placeholder:text-ink-subtle"
            data-testid="settings-name"
          />
        </Row>
      </Section>

      <Section header="Theme" footer={`${themeMeta(s.uiStyle).description} Shared with the desktop version.`}>
        <div className="grid grid-cols-2 gap-3 p-3" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => {
            const on = s.uiStyle === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ uiStyle: t.id, ...(t.accents.some((a) => a.id === s.accent) ? {} : { accent: t.accents[0].id }) })}
                className="text-left active:scale-[0.97]"
                data-testid={`m-theme-${t.id}`}
              >
                <span className={cn('block rounded-[21px] p-[3px] transition-colors', on ? 'bg-accent' : 'bg-transparent')}>
                  <PhoneThemePreview style={t.id} mode={supportsLight(t.id) ? live.mode : 'dark'} accent={t.accents.some((a) => a.id === s.accent) ? s.accent : t.accents[0].id} />
                </span>
                <span className="mt-1.5 flex items-center justify-center gap-1">
                  <span className={cn('ios-subhead font-medium', on ? 'text-accent' : 'text-ink')}>{t.name}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section header="Appearance" footer={supportsLight(s.uiStyle) ? 'Automatic follows your iPhone’s Light/Dark setting.' : `${themeMeta(s.uiStyle).name} is always dark.`}>
        <div className="px-4 py-2.5">
          <Segmented
            ariaLabel="Appearance"
            value={s.mobileTheme}
            onChange={(mobileTheme) => set({ mobileTheme })}
            options={[
              { value: 'system', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="flex min-h-11 items-center gap-3 px-4 py-1.5">
          <span className="ios-body flex-1 text-ink">Accent</span>
          <div className="-mr-1.5 flex" role="radiogroup" aria-label="Accent colour">
            {themeMeta(s.uiStyle).accents.map((a) => (
              <button key={a.id} type="button" role="radio" aria-checked={s.accent === a.id} aria-label={a.label} onClick={() => set({ accent: a.id })} className="flex size-11 items-center justify-center" data-testid={`accent-${a.id}`}>
                <span className={cn('size-7 rounded-full ring-offset-2 ring-offset-[var(--ios-cell)]', s.accent === a.id && 'ring-2 ring-ink-muted')} style={{ background: `var(--color-${a.id})` }} />
              </button>
            ))}
          </div>
        </div>
        <SelectRow
          testId="m-text-size"
          label="Text Size"
          value={String(s.textScale) as `${(typeof TEXT_SCALES)[number]}`}
          onChange={(v) => set({ textScale: Number(v) as (typeof TEXT_SCALES)[number] })}
          options={TEXT_SCALES.map((v) => ({ value: String(v) as `${(typeof TEXT_SCALES)[number]}`, label: v === 100 ? 'Default' : `${v}%` }))}
        />
        <SelectRow label="Motion" value={s.motion} onChange={(motion) => set({ motion })} options={[{ value: 'system', label: 'Match iPhone' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }]} />
        <Row label="Reduce Transparency" sub="Solid bars instead of glass">
          <IosSwitch checked={s.reduceTransparency} onChange={(reduceTransparency) => set({ reduceTransparency })} label="Reduce transparency" testId="settings-reduce-transparency" />
        </Row>
      </Section>

      <Section header="Region">
        <SelectRow label="Currency" value={s.currency} onChange={(currency) => set({ currency })} options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))} />
        <SelectRow label="Date Format" value={s.dateFormat} onChange={(dateFormat) => set({ dateFormat })} options={DATE_FORMATS.map((f) => ({ value: f, label: formatDate(todayISO(), f) }))} />
        <SelectRow label="Time Format" value={s.timeFormat} onChange={(timeFormat) => set({ timeFormat })} options={[{ value: '24h', label: '24-hour' }, { value: '12h', label: '12-hour' }]} />
        <SelectRow label="Week Starts On" value={String(s.weekStartsOn) as '0' | '1'} onChange={(v) => set({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
      </Section>

      <Section header="Working hours" footer="Shaded on the day timeline in Plan.">
        <Row label="Starts" htmlFor="m-work-start">
          <input id="m-work-start" type="time" value={s.workStart} onChange={(e) => e.target.value && set({ workStart: e.target.value })} className="rounded-[8px] bg-[var(--ios-fill)] px-2 text-ink" />
        </Row>
        <Row label="Ends" htmlFor="m-work-end">
          <input id="m-work-end" type="time" value={s.workEnd} onChange={(e) => e.target.value && set({ workEnd: e.target.value })} className="rounded-[8px] bg-[var(--ios-fill)] px-2 text-ink" />
        </Row>
        <div className="flex justify-between px-3 py-2" role="group" aria-label="Working days">
          {days.map((d) => {
            const on = s.workDays.includes(d.v)
            return (
              <button key={d.v} type="button" aria-pressed={on} aria-label={d.l} onClick={() => set({ workDays: on ? s.workDays.filter((x) => x !== d.v) : [...s.workDays, d.v].sort() })} className={cn('ios-subhead flex size-11 items-center justify-center rounded-full font-semibold', on ? 'bg-accent text-[var(--color-on-accent)]' : 'bg-[var(--ios-fill)] text-ink-muted')}>
                {d.s}
              </button>
            )
          })}
        </div>
      </Section>

      <Section>
        <Cell icon={Target} iconTone="magenta" title="Targets" detail={Object.values(s.targets).filter((v) => v !== undefined).length || undefined} chevron onClick={() => nav.push('more/settings/targets')} testId="settings-targets" />
        <Cell icon={FolderTree} iconTone="lime" title="Finance Categories" chevron onClick={() => nav.push('more/settings/categories')} />
      </Section>

      <Section header="Journal privacy" footer="Blur hides entry text in lists until you open an entry — a screen-privacy feature, not encryption.">
        <Row label="Blur Previews">
          <IosSwitch checked={s.journalBlur} onChange={(journalBlur) => set({ journalBlur })} label="Blur journal previews" testId="settings-blur" />
        </Row>
        <Row label="Reflection Prompts">
          <IosSwitch checked={s.journalPrompts} onChange={(journalPrompts) => set({ journalPrompts })} label="Show reflection prompts" />
        </Row>
      </Section>

      <Section>
        <Cell icon={Bell} iconTone="bad" title="Notifications" detail={s.reminders.enabled ? 'On' : 'Off'} subtitle="Reminders for tasks and events" chevron onClick={() => nav.push('more/settings/notifications')} testId="settings-notifications" />
      </Section>

      <Section footer="Everything stays on this iPhone. No account, no server, no analytics, no tracking.">
        <Cell icon={Database} iconTone="info" title="Data & Backups" detail={totalRecords(db) || undefined} subtitle="Export, import, restore" chevron onClick={() => nav.push('more/settings/data')} testId="settings-data" />
      </Section>

      <Section header="App">
        {!standalone && (
          <Cell
            icon={Smartphone}
            iconTone="cyan"
            title="Add to Home Screen"
            subtitle="Full screen, offline, and safer storage"
            chevron
            onClick={() =>
              actionSheet({
                title: 'Install LIFE OS',
                message: 'In Safari, tap the Share button (square with an arrow), then “Add to Home Screen”, then Add. Open LIFE OS from its icon from then on. Note: the Home Screen app and Safari keep separate data — export from one and import into the other to move it.',
                options: [],
                cancelLabel: 'Done',
              })
            }
          />
        )}
        <ActionCell icon={RotateCcw} onClick={async () => { if (await confirmAction({ title: 'Run setup again?', message: 'Shows the welcome screens again. Your data is not affected.', confirmLabel: 'Run Setup', tone: 'default' })) set({ onboarded: false }) }}>
          Run Setup Again
        </ActionCell>
      </Section>

      {/* What isn't active, said once rather than as rows that do nothing. */}
      <p className="ios-footnote mx-8 -mt-3 mb-7 text-ink-subtle" data-testid="m-not-connected-note">
        Not connected: cloud sync, calendar sync, bank connections, push notifications to a closed app and Apple Health each need an outside service, so none is active. Everything is entered by you and stays on this iPhone.
      </p>
    </Screen>
  )
}

// --------------------------------------------------------------- targets

const TARGETS: { field: keyof Settings['targets']; label: string; unit: string; min: number; max: number; decimals?: boolean }[] = [
  { field: 'weeklyWorkouts', label: 'Workouts per week', unit: 'per week', min: 1, max: 21 },
  { field: 'weeklyLearningMinutes', label: 'Learning per week', unit: 'minutes', min: 1, max: 10000 },
  { field: 'sleepHours', label: 'Sleep per night', unit: 'hours', min: 1, max: 14, decimals: true },
  { field: 'dailySteps', label: 'Daily steps', unit: 'steps', min: 1, max: 100000 },
  { field: 'yearlyReading', label: 'Books per year', unit: 'books', min: 1, max: 1000 },
  { field: 'weeklyJournalEntries', label: 'Journal entries per week', unit: 'per week', min: 1, max: 7 },
]

function TargetRow({ t }: { t: (typeof TARGETS)[number] }) {
  const s = useSettings()
  const value = s.targets[t.field] as number | undefined
  const [text, setText] = useState(value === undefined ? '' : String(value))
  useEffect(() => setText(value === undefined ? '' : String(value)), [value])
  const n = Number(text)
  const invalid = text.trim() !== '' && (!Number.isFinite(n) || n < t.min || n > t.max || (!t.decimals && !Number.isInteger(n)))
  const commit = () => {
    if (text.trim() === '') return set({ targets: { ...s.targets, [t.field]: undefined } })
    if (invalid) return
    set({ targets: { ...s.targets, [t.field]: t.decimals ? Math.round(n * 10) / 10 : n } })
  }
  const id = `m-target-${t.field}`
  return (
    <div>
      <Row label={t.label} sub={invalid ? <span className="text-bad">{t.decimals ? 'A number' : 'A whole number'} from {t.min} to {t.max.toLocaleString()}</span> : t.unit} htmlFor={id}>
        <input
          id={id}
          inputMode={t.decimals ? 'decimal' : 'numeric'}
          value={text}
          placeholder="Not set"
          onChange={(e) => setText(e.target.value.replace(',', '.'))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          aria-invalid={invalid || undefined}
          className={cn('w-28 bg-transparent text-right outline-none placeholder:text-ink-subtle', invalid ? 'text-bad' : 'text-ink-muted')}
          data-testid={`target-${t.field}`}
        />
      </Row>
    </div>
  )
}

export function NotificationsScreen() {
  const s = useSettings()
  const r = s.reminders
  const { permission, request } = useNotificationPermission()
  const setR = (patch: Partial<typeof r>) => actions.updateSettings({ reminders: { ...r, ...patch } })
  return (
    <Screen title="Notifications" testId="screen-notifications">
      <Section footer="A reminder shortly before tasks with a due time and calendar events. You can also set one on a single task when you edit it.">
        <Row label="Reminders">
          <IosSwitch
            checked={r.enabled}
            onChange={(on) => {
              setR({ enabled: on })
              if (on && permission === 'default') void request()
            }}
            label="Reminders"
            testId="m-reminders-enabled"
          />
        </Row>
        {r.enabled && (
          <>
            <Row label="Tasks with a Due Time">
              <IosSwitch checked={r.tasks} onChange={(tasks) => setR({ tasks })} label="Tasks with a due time" />
            </Row>
            <Row label="Calendar Events">
              <IosSwitch checked={r.events} onChange={(events) => setR({ events })} label="Calendar events" />
            </Row>
            <SelectRow label="When" value={String(r.lead)} onChange={(v) => setR({ lead: Number(v) })} options={REMINDER_LEAD_OPTIONS.map((m) => ({ value: String(m), label: leadLabel(m) }))} />
          </>
        )}
      </Section>
      {r.enabled && (
        <Section header="System notifications" footer={permissionText(permission, true)}>
          {permission === 'default' && (
            <ActionCell icon={BellRing} onClick={() => void request()} testId="m-reminders-allow">
              Allow Notifications
            </ActionCell>
          )}
          <ActionCell icon={Bell} onClick={() => void sendTestNotification()} testId="m-reminders-test">
            Send a Test
          </ActionCell>
        </Section>
      )}
      <Section header="Good to know" footer="Reminders run on this iPhone while LIFE OS is open or recently in the background. iOS doesn’t let a web app wake itself, so a reminder can’t arrive while LIFE OS is fully closed — that would need a push server, and LIFE OS keeps your data on this iPhone instead. If you open it up to 15 minutes late you’ll still see the reminder once.">
        <Cell title="Works best from the Home Screen" subtitle="iOS 16.4+ shows system notifications only for Home Screen apps" />
      </Section>
    </Screen>
  )
}

export function TargetsScreen() {
  return (
    <Screen title="Targets" testId="screen-targets">
      <Section footer="Optional. When set, Analytics and section overviews show progress against them. Leave blank and nothing is assumed.">
        {TARGETS.map((t) => (
          <TargetRow key={t.field} t={t} />
        ))}
      </Section>
    </Screen>
  )
}

// ------------------------------------------------------------ categories

export function CategoriesScreen() {
  const s = useSettings()
  const [kind, setKind] = useState<'expenseCategories' | 'incomeCategories'>('expenseCategories')
  const list = s[kind]
  return (
    <Screen
      title="Categories"
      testId="screen-categories"
      header={
        <div className="px-4 pb-2">
          <Segmented ariaLabel="Category type" value={kind} onChange={setKind} options={[{ value: 'expenseCategories', label: 'Spending' }, { value: 'incomeCategories', label: 'Income' }]} />
        </div>
      }
    >
      <Section footer="Removing a category only removes the suggestion — existing transactions keep theirs. Swipe left to remove.">
        {list.map((c) => (
          <SwipeRow key={c} actions={list.length > 1 ? [{ label: 'Remove', icon: Trash2, tone: 'bad', onAction: () => set({ [kind]: list.filter((x) => x !== c) } as Partial<Settings>) }] : []}>
            <Cell title={c} testId="m-category-row" />
          </SwipeRow>
        ))}
        <InlineAdd
          placeholder="New category"
          testId="category-add"
          onAdd={(title) => {
            const t = title.trim().slice(0, 60)
            if (list.some((x) => x.toLowerCase() === t.toLowerCase())) {
              toast({ title: `“${t}” already exists`, tone: 'info' })
              return
            }
            set({ [kind]: [...list, t] } as Partial<Settings>)
          }}
        />
      </Section>
    </Screen>
  )
}

// ----------------------------------------------------------- data & backups

const REASON: Record<BackupMeta['reason'], string> = { manual: 'Manual', auto: 'Automatic', 'pre-import': 'Before import', 'pre-restore': 'Before restore', 'pre-reset': 'Before reset' }

function ImportSheet({ result, onClose }: { result: (ValidationResult & { fileName: string }) | null; onClose: () => void }) {
  const db = useDatabase()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [busy, setBusy] = useState(false)
  const incoming = result?.ok ? countRecords(result.db) : {}
  const current = countRecords(db)
  const changed = COLLECTION_KEYS.filter((k) => (incoming[k] ?? 0) > 0 || (current[k] ?? 0) > 0)
  const apply = async () => {
    if (!result?.ok) return
    if (mode === 'replace') {
      const ok = await confirmAction({ title: 'Replace all current data?', message: `Your current ${totalRecords(db)} records will be replaced by the ${totalRecords(result.db)} in this file. A safety backup is saved first.`, confirmLabel: 'Replace Data' })
      if (!ok) return
    }
    setBusy(true)
    try {
      const r = await applyImport(result.db as Db, mode)
      toast({ title: 'Import complete', description: mode === 'merge' ? `${r.added ?? 0} added, ${r.updated ?? 0} updated.${r.removed ? ` ${r.removed} you’d deleted stay deleted (restore the safety backup or replace to bring them back).` : ''} Safety backup saved.` : 'Data replaced. Safety backup saved.' })
      onClose()
    } catch (e) {
      toast({ title: 'Import failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open={!!result}
      onClose={onClose}
      title="Review Import"
      testId="import-sheet"
      leading={<NavButton onClick={onClose}>Cancel</NavButton>}
      trailing={
        result?.ok ? (
          <NavButton bold onClick={apply} disabled={busy} testId="import-apply">
            {mode === 'merge' ? 'Merge' : 'Replace'}
          </NavButton>
        ) : undefined
      }
    >
      {result && !result.ok && (
        <Section header={result.fileName}>
          <div className="px-4 py-3">
            <p className="ios-headline text-bad">This file can’t be imported</p>
            <p className="ios-subhead mt-1 text-ink-muted">{result.error}</p>
          </div>
        </Section>
      )}
      {result?.ok && (
        <>
          <Section header={result.fileName} footer="Nothing has changed yet.">
            <Cell title="Validated records" detail={totalRecords(result.db)} />
            {result.rejected.length > 0 && <Cell title="Invalid — will be skipped" detail={<span className="text-warn">{result.rejected.length}</span>} />}
          </Section>
          {result.rejected.length > 0 && (
            <Section header="Skipped records">
              <ul className="max-h-40 overflow-y-auto px-4 py-2 font-mono text-[12px] text-ink-muted">
                {result.rejected.slice(0, 30).map((r, i) => (
                  <li key={i} className="py-0.5">
                    {r.collection}[{r.index}]: {r.problems.join('; ')}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section footer={mode === 'merge' ? 'Adds new records and updates ones in both — the most recently edited copy wins. Nothing is deleted. Your settings are kept.' : 'Swaps all current data, including settings, for the file’s contents.'}>
            <div className="px-4 py-2.5">
              <Segmented ariaLabel="Import mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace All' }]} />
            </div>
          </Section>
          <Section header="Records · now → in file">
            {changed.map((k) => (
              <Cell key={k} title={COLLECTIONS[k].plural} detail={<span className="tabular-nums">{current[k] ?? 0} → {incoming[k] ?? 0}</span>} />
            ))}
          </Section>
        </>
      )}
    </Sheet>
  )
}

export function DataScreen() {
  const db = useDatabase()
  const settings = useSettings()
  const storage = useApp((s) => s.storage)
  const save = useApp((s) => s.save)
  const [backups, setBackups] = useState<BackupMeta[] | null>(null)
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const [preview, setPreview] = useState<(ValidationResult & { fileName: string }) | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const records = totalRecords(db)
  const standalone = isStandalone()

  const refresh = useCallback(async () => {
    try {
      setBackups(await listBackups())
    } catch {
      setBackups([])
    }
    setEstimate(await storageEstimate())
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh, settings.backupsToKeep])

  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key)
    try {
      await fn()
      if (success) toast({ title: success })
    } catch (e) {
      toast({ title: 'Something went wrong', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  const exportNow = async () => {
    const r = await shareJsonFile(`life-os-backup-${todayISO()}.json`, makeBackupFile(db))
    if (r !== 'cancelled') markExported()
    if (r === 'downloaded') toast({ title: 'Backup downloaded', description: 'Find it in the Files app → Downloads.' })
  }
  const shareBackup = async (b: BackupMeta) => {
    const full = await getBackup(b.id)
    if (!full) return toast({ title: 'Backup not found', tone: 'error' })
    await shareJsonFile(`life-os-${b.reason}-${b.createdAt.slice(0, 10)}.json`, makeBackupFile(full.data))
  }
  const restore = async (b: BackupMeta) => {
    if (await confirmAction({ title: 'Restore this backup?', message: `Your current data will be replaced with the backup from ${new Date(b.createdAt).toLocaleString()} (${b.recordCount} records). A safety backup of the current data is saved first.`, confirmLabel: 'Restore', tone: 'default' }))
      await run(`restore-${b.id}`, async () => {
                        const r = await restoreBackup(b.id)
                        // Say so if some of the backup's records couldn't be read (they were left out).
                        if (r.rejected) toast({ title: `${r.rejected} record(s) in this backup couldn’t be read`, description: 'They were left out. The backup itself is unchanged.', tone: 'warning' })
                      }, 'Backup restored')
  }
  const remove = async (b: BackupMeta) => {
    if (await confirmAction({ title: 'Delete this backup?', message: 'The backup is permanently removed. Your current data is not affected.', confirmLabel: 'Delete Backup' })) await run(`del-${b.id}`, () => deleteBackup(b.id), 'Backup deleted')
  }

  return (
    <Screen title="Data & Backups" testId="screen-data">
      <Section
        header="Storage"
        footer={
          <>
            Data stays on this iPhone, in this {standalone ? 'Home Screen app' : 'browser'}.{' '}
            {standalone ? 'Safari keeps its own separate copy — use Export and Import to move data between them.' : 'If you use LIFE OS in Safari without adding it to your Home Screen, Safari may clear its data after about a week without a visit. Add it to your Home Screen, and export backups regularly.'}
          </>
        }
      >
        <Cell title="Records" detail={<span data-testid="data-records">{records}</span>} />
        <Cell title="Storage" subtitle={storage?.label ?? '—'} />
        <Cell title="Space Used" detail={estimate.usage !== undefined ? formatBytes(estimate.usage) : 'Unknown'} subtitle={estimate.quota ? `About ${formatBytes(estimate.quota)} available` : undefined} />
        <Cell title="Last Saved" detail={save.status === 'error' ? <span className="text-bad">Failed</span> : save.lastSavedAt ? new Date(save.lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} />
        <Cell
          title="Protection"
          subtitle="Asks iOS not to clear data when space is low"
          detail={estimate.persisted ? <span className="text-ok">On</span> : estimate.persisted === false ? 'Off' : 'Unknown'}
          chevron={estimate.persisted === false}
          onClick={
            estimate.persisted === false
              ? async () => {
                  const granted = await requestPersistentStorage()
                  toast(granted ? { title: 'Storage protected' } : { title: 'Not granted yet', description: 'iOS decides this itself — it’s more likely once LIFE OS is on your Home Screen and used regularly.', tone: 'info' })
                  void refresh()
                }
              : undefined
          }
        />
      </Section>

      <Section header="Export & import" footer="Export saves every record and setting as one JSON file (Save to Files, AirDrop, Mail…). Imports are checked and previewed first, and a safety backup is saved before anything changes.">
        <ActionCell icon={Share} onClick={exportNow} testId="data-export">
          Export Backup
        </ActionCell>
        <ActionCell icon={Upload} onClick={() => file.current?.click()} testId="data-import">
          Import From File…
        </ActionCell>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="data-import-file"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setPreview(await inspectImportFile(f))
          }}
        />
      </Section>

      <Section header="Backups on this iPhone" footer="Manual and safety backups are never removed automatically. Tap a backup to restore, share or delete it.">
        <Row label="Daily Automatic Backup" sub="When you open LIFE OS, at most once a day">
          <IosSwitch checked={settings.autoBackup} onChange={(autoBackup) => actions.updateSettings({ autoBackup })} label="Daily automatic backup" />
        </Row>
        <SelectRow
          label="Automatic Backups to Keep"
          value={String(settings.backupsToKeep) as '3' | '7' | '14' | '30'}
          onChange={(v) => {
            const keep = Number(v)
            actions.updateSettings({ backupsToKeep: keep })
            void pruneAutoBackups(keep).then(refresh)
          }}
          options={['3', '7', '14', '30'].map((n) => ({ value: n as '3' | '7' | '14' | '30', label: n }))}
        />
        <ActionCell icon={Download} onClick={() => run('create', () => createBackup('manual'), 'Backup saved')} disabled={busy === 'create'} testId="data-backup-now">
          Back Up Now
        </ActionCell>
      </Section>
      <Section>
        {backups === null && <EmptyRow>Loading backups…</EmptyRow>}
        {backups?.length === 0 && <EmptyRow>No backups yet. One is made automatically each day once you have data, and before any import, restore or reset.</EmptyRow>}
        {backups?.map((b) => (
          <SwipeRow key={b.id} actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void remove(b) }]}>
            <Cell
              title={new Date(b.createdAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              subtitle={[REASON[b.reason], `${b.recordCount} records`, formatBytes(b.sizeBytes), b.label].filter(Boolean).join(' · ')}
              chevron
              testId="m-backup-row"
              onClick={() =>
                actionSheet({
                  title: new Date(b.createdAt).toLocaleString(),
                  message: `${b.recordCount} records · ${REASON[b.reason]}`,
                  options: [
                    { label: 'Restore This Backup', onSelect: () => void restore(b) },
                    { label: 'Share / Save to Files', onSelect: () => void shareBackup(b) },
                    { label: 'Delete Backup', destructive: true, onSelect: () => void remove(b) },
                  ],
                })
              }
            />
          </SwipeRow>
        ))}
      </Section>

      <Section header="Danger zone" footer="A backup is saved before each of these, so they can be undone from Backups.">
        <ActionCell
          destructive
          testId="data-clear-activity"
          onClick={async () => {
            if (await confirmAction({ title: 'Clear activity log?', message: `${db.activity.length} activity entries will be removed. Records are not affected.`, confirmLabel: 'Clear Log' })) {
              await createBackup('manual', 'Before clearing activity log')
              appStore.getState().clearActivity()
              toast({ title: 'Activity log cleared', description: 'A backup was saved first.' })
              void refresh()
            }
          }}
        >
          Clear Activity Log
        </ActionCell>
        <ActionCell
          destructive
          testId="data-erase"
          onClick={async () => {
            if (await confirmAction({ title: 'Erase all records?', message: `All ${records} records will be erased. Your settings are kept. A backup is saved first.`, requireText: 'ERASE', confirmLabel: 'Erase Records' })) await run('reset', () => resetAllData({ keepSettings: true }), 'All records erased — backup saved')
          }}
        >
          Erase All Records
        </ActionCell>
        <ActionCell
          destructive
          testId="data-factory-reset"
          onClick={async () => {
            if (await confirmAction({ title: 'Factory reset?', message: 'Erases every record AND your settings, then shows first-time setup again. A backup is saved first.', requireText: 'RESET', confirmLabel: 'Factory Reset' })) await run('factory', () => resetAllData({ keepSettings: false }), 'Reset complete — backup saved')
          }}
        >
          Factory Reset
        </ActionCell>
      </Section>

      <ImportSheet result={preview} onClose={() => setPreview(null)} />
    </Screen>
  )
}
