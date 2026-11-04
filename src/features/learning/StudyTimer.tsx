import { Pause, Play, Square, Timer } from 'lucide-react'
import { useCollection } from '@/store/store'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/inputs'
import { Panel } from '@/components/ui/Panel'
import { useStudyTimer } from './useStudyTimer'

/**
 * A focus timer for study sessions. It keeps running across page reloads
 * (the start time is remembered on this device). Stopping opens a pre-filled
 * study session for you to confirm — nothing is logged without your say-so.
 */
export function StudyTimer() {
  const skills = useCollection('skills')
  const { state, elapsed, hh, mm, ss, start, pause, stop, setSkill } = useStudyTimer()
  return (
    <Panel title="Study timer" icon={Timer}>
      <p className="text-center font-mono text-[40px] leading-none text-ink tabular" aria-live="off" aria-label={`Elapsed ${hh} hours ${mm} minutes`}>
        {hh}:{mm}
        <span className="text-[24px] text-ink-subtle">:{ss}</span>
      </p>
      <Select size="sm" className="mt-4" value={state.skillId ?? ''} onChange={(e) => setSkill(e.target.value || undefined)} aria-label="Skill for this session">
        <option value="">No skill selected</option>
        {skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {state.running ? (
          <Button icon={Pause} onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button variant="primary" icon={Play} onClick={start}>
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
