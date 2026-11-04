import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HardDrive, Lock, Sparkles } from 'lucide-react'
import { CURRENCIES } from '@/lib/format'
import { cn } from '@/lib/utils'
import { applyImport, inspectImportFile } from '@/store/backups'
import { actions, useSettings } from '@/store/store'
import { toast } from '@/components/ui/toast'
import { Segmented } from '../../ui/controls'
import { Cell, Section } from '../../ui/List'

/** First launch on iPhone: three short steps, nothing invented. */
export function MobileOnboarding() {
  const s = useSettings()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(s.displayName)
  const file = useRef<HTMLInputElement>(null)
  const finish = () => {
    actions.updateSettings({ displayName: name.trim(), onboarded: true })
    toast({ title: name.trim() ? `Welcome, ${name.trim()}` : 'Welcome to Atlas' })
  }
  return (
    <main className="absolute inset-0 flex flex-col bg-[var(--ios-grouped)]" style={{ paddingTop: 'calc(var(--safe-top) + 24px)', paddingBottom: 'calc(var(--safe-bottom) + 16px)' }} data-testid="m-onboarding">
      <div className="ios-scroll min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
            {step === 0 && (
              <div className="px-6 pt-10">
                <img src={`${import.meta.env.BASE_URL}m/icon-192.png`} alt="" className="size-20 rounded-[18px] shadow-lg" />
                <h1 className="ios-large-title mt-6 text-ink">Welcome to Atlas</h1>
                <p className="ios-body mt-2 text-ink-subtle">Your goals, plans, habits, money, health, learning and journal — in one private place.</p>
                <ul className="mt-8 space-y-5">
                  {[
                    { icon: Lock, title: 'Private', text: 'Everything stays on this iPhone. No account, no tracking.' },
                    { icon: Sparkles, title: 'Starts empty', text: 'No sample data. Every number comes from what you record.' },
                    { icon: HardDrive, title: 'Yours to keep', text: 'Export a backup to Files at any time.' },
                  ].map((f) => (
                    <li key={f.title} className="flex gap-4">
                      <f.icon size={28} className="mt-0.5 shrink-0 text-accent" />
                      <div>
                        <p className="ios-headline text-ink">{f.title}</p>
                        <p className="ios-subhead text-ink-subtle">{f.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {step === 1 && (
              <div className="pt-10">
                <h1 className="ios-large-title px-6 text-ink">What should we call you?</h1>
                <p className="ios-body mt-2 mb-6 px-6 text-ink-subtle">Used in your greeting. Optional.</p>
                <Section>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name"
                    autoComplete="given-name"
                    enterKeyHint="next"
                    onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
                    className="w-full bg-transparent px-4 text-ink outline-none"
                    data-testid="m-onboarding-name"
                  />
                </Section>
              </div>
            )}
            {step === 2 && (
              <div className="pt-10">
                <h1 className="ios-large-title px-6 text-ink">Preferences</h1>
                <p className="ios-body mt-2 mb-6 px-6 text-ink-subtle">You can change these any time in Settings.</p>
                <Section header="Appearance">
                  <div className="px-4 py-2.5">
                    <Segmented
                      value={s.mobileTheme}
                      onChange={(mobileTheme) => actions.updateSettings({ mobileTheme })}
                      ariaLabel="Appearance"
                      options={[
                        { value: 'system', label: 'Automatic' },
                        { value: 'light', label: 'Light' },
                        { value: 'dark', label: 'Dark' },
                      ]}
                    />
                  </div>
                </Section>
                <Section header="Region">
                  <Cell
                    title="Currency"
                    trailing={
                      <select value={s.currency} onChange={(e) => actions.updateSettings({ currency: e.target.value })} aria-label="Currency" className="!min-h-0 max-w-[55%] bg-transparent text-right text-ink-subtle outline-none">
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    }
                  />
                  <div className="flex min-h-11 items-center justify-between gap-3 px-4">
                    <span className="ios-body text-ink">Week starts on</span>
                    <Segmented className="w-44" value={String(s.weekStartsOn) as '0' | '1'} onChange={(v) => actions.updateSettings({ weekStartsOn: Number(v) as 0 | 1 })} ariaLabel="Week starts on" options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
                  </div>
                </Section>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="px-6 pt-3">
        <div className="mb-4 flex justify-center gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn('h-2 rounded-full transition-all', i === step ? 'w-5 bg-accent' : 'w-2 bg-[var(--color-line-strong)]')} />
          ))}
        </div>
        <button type="button" onClick={() => (step < 2 ? setStep(step + 1) : finish())} className="ios-headline h-[50px] w-full rounded-[14px] bg-accent text-on-accent active:opacity-80" data-testid="m-onboarding-next">
          {step === 0 ? 'Get Started' : step === 1 ? 'Continue' : 'Start Using Atlas'}
        </button>
        <div className="mt-2 flex justify-between">
          {step === 0 ? (
            <>
              <input
                ref={file}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  const r = await inspectImportFile(f)
                  if (!r.ok) return toast({ title: 'Could not restore', description: r.error, tone: 'error' })
                  await applyImport(r.db, 'replace')
                  toast({ title: 'Backup restored' })
                }}
              />
              <button type="button" className="ios-body h-11 text-accent" onClick={() => file.current?.click()}>
                Restore a Backup
              </button>
              <button type="button" className="ios-body h-11 text-accent" onClick={finish} data-testid="m-onboarding-skip">
                Skip
              </button>
            </>
          ) : (
            <button type="button" className="ios-body h-11 text-accent" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
