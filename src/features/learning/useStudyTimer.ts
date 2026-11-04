/**
 * Study focus timer, shared by the desktop and iPhone versions. The start
 * time is remembered on this device so the timer keeps running across
 * reloads. Stopping opens a pre-filled study session for confirmation —
 * nothing is logged without the person's say-so.
 */
import { useEffect, useState } from 'react'
import { editor } from '@/components/editor/editorStore'
import { toast } from '@/components/ui/toast'

const KEY = 'life-os:study-timer'

export interface TimerState {
  running: boolean
  startedAt?: number
  accumulated: number
  skillId?: string
}

function load(): TimerState {
  try {
    return { accumulated: 0, running: false, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<TimerState>) }
  } catch {
    return { accumulated: 0, running: false }
  }
}

function persist(s: TimerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // The timer still works for this session without storage.
  }
}

export function useStudyTimer() {
  const [state, setState] = useState<TimerState>(load)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!state.running) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [state.running])
  const update = (s: TimerState) => {
    setState(s)
    persist(s)
  }
  const elapsed = state.accumulated + (state.running && state.startedAt ? Date.now() - state.startedAt : 0)
  const secs = Math.floor(elapsed / 1000)
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return {
    state,
    elapsed,
    hh,
    mm,
    ss,
    start: () => update({ ...state, running: true, startedAt: Date.now() }),
    pause: () => update({ ...state, running: false, accumulated: elapsed, startedAt: undefined }),
    setSkill: (skillId: string | undefined) => update({ ...state, skillId }),
    stop: () => {
      const minutes = Math.max(1, Math.round(elapsed / 60000))
      update({ running: false, accumulated: 0, skillId: state.skillId })
      if (elapsed < 30_000) {
        toast({ title: 'Timer reset', description: 'Sessions under 30 seconds are not logged.', tone: 'info' })
        return
      }
      editor.create('studySessions', { durationMin: minutes, skillId: state.skillId })
    },
  }
}
