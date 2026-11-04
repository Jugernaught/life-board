import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, HardDrive, Lock, Sparkles, Upload } from 'lucide-react'
import { WIDGET_META } from '@/data/defaults'
import { DATE_FORMATS, formatDate, todayISO } from '@/lib/dates'
import { CURRENCIES } from '@/lib/format'
import { cn } from '@/lib/utils'
import { applyImport, inspectImportFile } from '@/store/backups'
import { actions, useSettings } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/inputs'
import { WeekdayPicker } from '@/components/ui/pickers'
import { toast } from '@/components/ui/toast'
import { BackgroundFX } from '@/components/layout/BackgroundFX'
import { Logo } from '@/components/layout/Sidebar'

const STEPS = ['Welcome', 'You', 'Region', 'Schedule', 'Dashboard'] as const

/**
 * First-time setup. Everything here is a preference — no sample data is
 * created. "Skip" keeps sensible defaults that can be changed in Settings.
 */
export default function Onboarding() {
  const settings = useSettings()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.displayName)
  const fileInput = useRef<HTMLInputElement>(null)
  const set = actions.updateSettings

  const finish = () => {
    set({ displayName: name.trim(), onboarded: true })
    toast({ title: `Welcome${name.trim() ? `, ${name.trim()}` : ''}`, description: 'Atlas is ready. Press N to add anything, Ctrl K to search.' })
  }

  const importBackup = async (file: File) => {
    const result = await inspectImportFile(file)
    if (!result.ok) {
      toast({ title: 'Could not import', description: result.error, tone: 'error' })
      return
    }
    await applyImport(result.db, 'replace')
    toast({ title: 'Backup restored', description: `Imported from ${result.fileName}` })
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 py-10">
      <BackgroundFX enabled={settings.effects} />
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <ol className="flex items-center gap-1.5" aria-label="Setup progress">
            {STEPS.map((s, i) => (
              <li key={s} className={cn('h-1 w-6 rounded-full transition-colors', i <= step ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'bg-ink/10')} aria-current={i === step ? 'step' : undefined}>
                <span className="sr-only">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel hud overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="p-6 sm:p-8">
              {step === 0 && (
                <div>
                  <p className="eyebrow text-accent/80">Setup · 1 of {STEPS.length}</p>
                  <h1 className="mt-3 font-display text-[30px] leading-tight font-semibold">
                    Your personal <span className="text-gradient">command centre</span>.
                  </h1>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">
                    Atlas brings your goals, work, studies, money, health, learning, writing and relationships into one place — and turns what you record into clear progress.
                  </p>
                  <ul className="mt-5 space-y-3 text-[13.5px]">
                    <li className="flex gap-3">
                      <Lock size={17} className="mt-0.5 shrink-0 text-accent" />
                      <span className="text-ink-muted">
                        <span className="text-ink">Private by design.</span> Everything is stored on this device, in this browser. Nothing is sent to a server.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <HardDrive size={17} className="mt-0.5 shrink-0 text-accent" />
                      <span className="text-ink-muted">
                        <span className="text-ink">Yours to keep.</span> Export a full JSON backup any time; daily automatic backups are kept locally.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <Sparkles size={17} className="mt-0.5 shrink-0 text-accent" />
                      <span className="text-ink-muted">
                        <span className="text-ink">Starts empty.</span> No sample data — every number you see will come from what you enter.
                      </span>
                    </li>
                  </ul>
                </div>
              )}
              {step === 1 && (
                <div>
                  <p className="eyebrow text-accent/80">Setup · 2 of {STEPS.length}</p>
                  <h2 className="mt-3 font-display text-[24px] font-semibold">What should we call you?</h2>
                  <p className="mt-2 text-[14px] text-ink-muted">Used for your greeting. You can leave it blank.</p>
                  <Field label="Display name" htmlFor="ob-name" className="mt-5">
                    <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" maxLength={60} autoFocus onKeyDown={(e) => e.key === 'Enter' && setStep(2)} />
                  </Field>
                  <div className="mt-5 space-y-3">
                    <p className="text-[12px] font-medium text-ink-muted">Appearance</p>
                    <Segmented
                      value={settings.theme}
                      onChange={(theme) => set({ theme })}
                      fullWidth
                      ariaLabel="Theme"
                      options={[
                        { value: 'dark', label: 'Dark' },
                        { value: 'light', label: 'Light' },
                        { value: 'system', label: 'Match system' },
                      ]}
                    />
                    <div className="flex gap-2" role="radiogroup" aria-label="Accent colour">
                      {(['cyan', 'violet', 'magenta', 'lime'] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          role="radio"
                          aria-checked={settings.accent === a}
                          aria-label={`${a} accent`}
                          onClick={() => set({ accent: a })}
                          className={cn('h-9 flex-1 rounded-lg border-2 capitalize transition', settings.accent === a ? 'border-ink' : 'border-transparent')}
                          style={{ background: `color-mix(in oklab, var(--color-${a}) 22%, transparent)`, color: `var(--color-${a})` }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-lg border border-line bg-panel-2/40 px-3 py-2.5">
                      <Switch checked={settings.effects} onChange={(effects) => set({ effects })} label="Background effects" description="Subtle grid and light blooms behind the interface" />
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div>
                  <p className="eyebrow text-accent/80">Setup · 3 of {STEPS.length}</p>
                  <h2 className="mt-3 font-display text-[24px] font-semibold">Region & formats</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Currency" htmlFor="ob-currency">
                      <Select id="ob-currency" value={settings.currency} onChange={(e) => set({ currency: e.target.value })}>
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Date format" htmlFor="ob-date">
                      <Select id="ob-date" value={settings.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as never })}>
                        {DATE_FORMATS.map((f) => (
                          <option key={f} value={f}>
                            {formatDate(todayISO(), f)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Time format">
                      <Segmented value={settings.timeFormat} onChange={(timeFormat) => set({ timeFormat })} fullWidth options={[{ value: '24h', label: '24-hour' }, { value: '12h', label: '12-hour' }]} ariaLabel="Time format" />
                    </Field>
                    <Field label="Week starts on">
                      <Segmented value={String(settings.weekStartsOn) as '0' | '1'} onChange={(v) => set({ weekStartsOn: Number(v) as 0 | 1 })} fullWidth options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} ariaLabel="Week start" />
                    </Field>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div>
                  <p className="eyebrow text-accent/80">Setup · 4 of {STEPS.length}</p>
                  <h2 className="mt-3 font-display text-[24px] font-semibold">Your working rhythm</h2>
                  <p className="mt-2 text-[14px] text-ink-muted">Working hours are highlighted on your daily timeline.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Field label="Start" htmlFor="ob-ws">
                      <Input id="ob-ws" type="time" value={settings.workStart} onChange={(e) => e.target.value && set({ workStart: e.target.value })} />
                    </Field>
                    <Field label="End" htmlFor="ob-we">
                      <Input id="ob-we" type="time" value={settings.workEnd} onChange={(e) => e.target.value && set({ workEnd: e.target.value })} />
                    </Field>
                    <Field label="Working days" className="sm:col-span-2">
                      <WeekdayPicker value={settings.workDays} onChange={(workDays) => set({ workDays })} weekStartsOn={settings.weekStartsOn} />
                    </Field>
                    <Field label="Default calendar view" className="sm:col-span-2">
                      <Segmented value={settings.defaultCalendarView} onChange={(v) => set({ defaultCalendarView: v })} fullWidth ariaLabel="Default calendar view" options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
                    </Field>
                  </div>
                </div>
              )}
              {step === 4 && (
                <div>
                  <p className="eyebrow text-accent/80">Setup · 5 of {STEPS.length}</p>
                  <h2 className="mt-3 font-display text-[24px] font-semibold">Choose your dashboard widgets</h2>
                  <p className="mt-2 text-[14px] text-ink-muted">You can reorder and resize them later from the Command Centre.</p>
                  <div className="mt-4 grid max-h-[46vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {settings.dashboard.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        aria-pressed={w.visible}
                        onClick={() => set({ dashboard: settings.dashboard.map((x) => (x.id === w.id ? { ...x, visible: !x.visible } : x)) })}
                        className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all', w.visible ? 'border-accent/50 bg-accent/8' : 'border-line bg-panel-2/30 opacity-70 hover:opacity-100')}
                      >
                        <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', w.visible ? 'border-accent bg-accent text-on-accent' : 'border-line-strong')}>{w.visible && <Check size={11} strokeWidth={3} />}</span>
                        <span>
                          <span className="block text-[13px] text-ink">{WIDGET_META[w.id].title}</span>
                          <span className="block text-[11.5px] text-ink-subtle">{WIDGET_META[w.id].description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-panel-2/40 px-6 py-4 sm:px-8">
            {step === 0 ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void importBackup(f)
                    e.target.value = ''
                  }}
                />
                <Button variant="ghost" size="sm" icon={Upload} onClick={() => fileInput.current?.click()}>
                  Restore a backup
                </Button>
              </>
            ) : (
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 && (
              <Button variant="ghost" onClick={finish}>
                Skip setup
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" iconRight={ArrowRight} onClick={() => setStep((s) => s + 1)} data-testid="onboarding-next">
                {step === 0 ? 'Get started' : 'Continue'}
              </Button>
            ) : (
              <Button variant="primary" icon={Check} onClick={finish} data-testid="onboarding-finish">
                Enter Atlas
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
