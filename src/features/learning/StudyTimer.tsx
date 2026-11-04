import { useEffect, useState } from 'react'
import { Pause, Play, Square, Timer } from 'lucide-react'
import { useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { editor } from '@/components/editor/editorStore'
import { toast } from '@/components/ui/toast'

const KEY = 'life-os:study-timer'
interface TimerState {
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
    // Timer still works for this session without storage.
  }
}

/**
 * A focus timer for study sessions. It keeps running across page reloads
 * (the start time is remembered on this device). Stopping opens a pre-filled
 * study session for you to confirm — nothing is logged without your say-so.
 */
export function StudyTimer() {
  const skills = useCollection('skills')
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
  const stop = () => {
    const minutes = Math.max(1, Math.round(elapsed / 60000))
    update({ running: false, accumulated: 0, skillId: state.skillId })
    if (elapsed < 30_000) {
      toast({ title: 'Timer reset', description: 'Sessions under 30 seconds are not logged.', tone: 'info' })
      return
    }
    editor.create('studySessions', { durationMin: minutes, skillId: state.skillId })
  }
  return (
    <Panel title="Study timer" icon={Timer}>
      <p className="text-center font-mono text-[40px] leading-none text-ink tabular" aria-live="off" aria-label={`Elapsed ${hh} hours ${mm} minutes`}>
        {hh}:{mm}
        <span className="text-[24px] text-ink-subtle">:{ss}</span>
      </p>
      <Select size="sm" className="mt-4" value={state.skillId ?? ''} onChange={(e) => update({ ...state, skillId: e.target.value || undefined })} aria-label="Skill for this session">
        <option value="">No skill selected</option>
        {skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {state.running ? (
          <Button icon={Pause} onClick={() => update({ ...state, running: false, accumulated: elapsed, startedAt: undefined })}>
            Pause
          </Button>
        ) : (
          <Button variant="primary" icon={Play} onClick={() => update({ ...state, running: true, startedAt: Date.now() })}>
            {elapsed > 0 ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button icon={Square} onClick={stop} disabled={elapsed === 0}>
          Stop & log
        </Button>
      </div>
      <p className="mt-2 text-center text-[11.5px] text-ink-subtle">Stopping opens the session for you to confirm.</p>
    </Panel>
  )
}
