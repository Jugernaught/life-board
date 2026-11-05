/**
 * Local reminders: a notification shortly before a task's due time or an
 * event's start — while LIFE OS is open (or, for the Windows app, running in
 * the background). There is no server, so nothing can arrive while the app is
 * fully closed; Settings says so plainly.
 *
 * `upcomingReminders` is pure (unit tested). `useReminders` schedules timers,
 * re-plans whenever data changes or the device wakes, and remembers what has
 * already fired so a reload — or a second tab — never repeats a reminder.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Database, Settings } from '@/data/types'
import { addDaysISO, formatTime, localInstant, toISODate } from '@/lib/dates'
import { appStore } from '@/store/store'
import { toast } from '@/components/ui/toast'

export interface Reminder {
  /** Stable per record and fire time, so moving a task re-arms its reminder. */
  key: string
  kind: 'tasks' | 'events'
  recordId: string
  title: string
  body: string
  at: number
}

/** A reminder missed by up to this long (app was closed, laptop asleep) still shows once. */
export const MISSED_GRACE_MS = 15 * 60_000
const HORIZON_DAYS = 2


const leadText = (mins: number) => (mins === 0 ? 'now' : mins < 60 ? `in ${mins} min` : mins % 1440 === 0 ? `in ${mins / 1440} day${mins === 1440 ? '' : 's'}` : `in ${Math.round(mins / 60)} h`)

/** Reminders due between `now - grace` and the next couple of days, soonest first. */
export function upcomingReminders(db: Pick<Database, 'tasks' | 'events'>, settings: Pick<Settings, 'reminders' | 'timeFormat'>, now: number): Reminder[] {
  const r = settings.reminders
  if (!r?.enabled) return []
  const today = toISODate(new Date(now))
  const last = addDaysISO(today, HORIZON_DAYS)
  const out: Reminder[] = []
  for (const t of db.tasks) {
    if (t.status === 'done' || !t.dueDate || !t.dueTime || t.dueDate > last) continue
    const lead = t.remindBefore ?? (r.tasks ? r.lead : undefined)
    if (lead === undefined) continue
    const fire = localInstant(t.dueDate, t.dueTime) - lead * 60_000
    out.push({ key: `t:${t.id}@${fire}`, kind: 'tasks', recordId: t.id, title: t.title, body: `Task due ${leadText(lead)} · ${formatTime(t.dueTime, settings.timeFormat)}`, at: fire })
  }
  if (r.events) {
    for (const e of db.events) {
      if (e.allDay || !e.startTime || e.date > last) continue
      const fire = localInstant(e.date, e.startTime) - r.lead * 60_000
      const where = e.location ? ` · ${e.location}` : ''
      out.push({ key: `e:${e.id}@${fire}`, kind: 'events', recordId: e.id, title: e.title, body: `Starts ${leadText(r.lead)} · ${formatTime(e.startTime, settings.timeFormat)}${where}`, at: fire })
    }
  }
  return out.filter((x) => Number.isFinite(x.at) && x.at > now - MISSED_GRACE_MS).sort((a, b) => a.at - b.at)
}

// ------------------------------------------------------------ delivery ---

const FIRED_KEY = 'life-os:reminders-fired'

function readFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** Mark as fired; returns false if it already was (another tab got there first). */
function claim(key: string, now: number): boolean {
  const fired = readFired()
  if (fired[key]) return false
  // Forget entries older than a week.
  for (const [k, t] of Object.entries(fired)) if (now - t > 7 * 86_400_000) delete fired[k]
  fired[key] = now
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired))
  } catch {
    // Storage full or blocked: worst case a reminder could repeat after reload.
  }
  return true
}

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported'

export const notificationPermission = (): NotifyPermission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return notificationPermission()
  }
}

/** Current permission, refreshed when you come back to the app (it can change in browser settings). */
export function useNotificationPermission() {
  const [perm, setPerm] = useState<NotifyPermission>(notificationPermission)
  useEffect(() => {
    const refresh = () => setPerm(notificationPermission())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])
  const request = useCallback(async () => {
    const p = await requestNotificationPermission()
    setPerm(p)
    return p
  }, [])
  return { permission: perm, request }
}

/** Plain-English status for Settings. */
export function permissionText(p: NotifyPermission, iphone: boolean): string {
  switch (p) {
    case 'granted':
      return 'Allowed — reminders also appear as system notifications when LIFE OS is in the background.'
    case 'denied':
      return iphone ? 'Blocked. Turn notifications on in iPhone Settings → Notifications → LIFE OS. Until then reminders show as banners inside the app.' : 'Blocked in your browser’s site settings. Until you allow them, reminders show as banners inside LIFE OS.'
    case 'default':
      return 'Not allowed yet. Without permission, reminders show as banners inside the app.'
    case 'unsupported':
      return iphone ? 'System notifications need LIFE OS on your Home Screen (iOS 16.4 or later). In Safari, reminders show as banners inside the app.' : 'This browser can’t show system notifications; reminders show as banners inside LIFE OS.'
  }
}

export const REMINDER_LEAD_OPTIONS = [0, 5, 10, 15, 30, 60, 120] as const
export const leadLabel = (m: number) => (m === 0 ? 'At the time' : m < 60 ? `${m} minutes before` : `${m / 60} hour${m === 60 ? '' : 's'} before`)

type OpenRecord = (kind: Reminder['kind'], id: string) => void

/** Show a system notification (via the service worker where there is one — required on iPhone). */
async function systemNotify(title: string, body: string, tag: string, onClick?: () => void, data?: { kind: string; id: string }): Promise<boolean> {
  if (notificationPermission() !== 'granted') return false
  const icon = `${import.meta.env.BASE_URL}m/icon-192.png`
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) {
      await reg.showNotification(title, { body, tag, icon, badge: icon, data })
      return true
    }
    const n = new Notification(title, { body, tag, icon })
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
    return true
  } catch {
    return false
  }
}

export async function deliver(rem: Reminder, open: OpenRecord) {
  const shownBySystem = document.visibilityState === 'hidden' ? await systemNotify(rem.title, rem.body, rem.key, () => open(rem.kind, rem.recordId), { kind: rem.kind, id: rem.recordId }) : false
  // In the app (or when notifications aren't allowed): an in-app banner.
  if (!shownBySystem) toast({ title: rem.title, description: rem.body, tone: 'info', duration: 12_000, action: { label: 'Open', onClick: () => open(rem.kind, rem.recordId) } })
}

/** Test button in Settings. */
export async function sendTestNotification() {
  const ok = await systemNotify('LIFE OS reminders are on', 'This is how a reminder will look.', 'life-os-test')
  if (!ok) toast({ title: 'LIFE OS reminders are on', description: 'Reminders will appear like this while LIFE OS is open.', tone: 'info' })
  return ok
}

/** Keeps reminder timers in step with your data. Mount once per app. */
export function useReminders(open: OpenRecord) {
  useEffect(() => {
    let timer: number | undefined
    const plan = () => {
      window.clearTimeout(timer)
      const { db, ready } = appStore.getState()
      if (!ready) return
      const now = Date.now()
      const list = upcomingReminders(db, db.settings, now)
      for (const rem of list) {
        if (rem.at > now) break
        if (claim(rem.key, now)) void deliver(rem, open)
      }
      const next = list.find((x) => x.at > now)
      // Wake for the next one, and at least every 10 minutes (timers drift while asleep).
      const wait = Math.min(next ? next.at - now : Infinity, 10 * 60_000)
      timer = window.setTimeout(plan, Math.max(500, wait))
    }
    plan()
    const unsub = appStore.subscribe((s, prev) => {
      if (s.db.tasks !== prev.db.tasks || s.db.events !== prev.db.events || s.db.settings !== prev.db.settings || s.ready !== prev.ready) plan()
    })
    const onWake = () => document.visibilityState === 'visible' && plan()
    // A tapped notification (iPhone) asks the page to open its record.
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; kind?: Reminder['kind']; id?: string } | undefined
      if (d?.type === 'life-os:open-record' && d.kind && d.id) open(d.kind, d.id)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', plan)
    return () => {
      window.clearTimeout(timer)
      unsub()
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', plan)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
