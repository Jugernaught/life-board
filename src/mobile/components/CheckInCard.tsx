import { useState } from 'react'
import { ENERGY_SCALE, MOOD_SCALE } from '@/data/constants'
import { actions, useDatabase } from '@/store/store'
import { toast } from '@/components/ui/toast'
import { Section } from '../ui/List'

/** Two-tap mood then energy check-in. */
export function CheckInCard({ today, date = today }: { today: string; date?: string }) {
  const [mood, setMood] = useState<number>()
  const db = useDatabase()
  const latest = db.checkIns.filter((c) => c.date === date).sort((a, b) => (a.at < b.at ? 1 : -1))[0]
  return (
    <Section header="How are you?" footer={latest ? `Latest check-in: ${MOOD_SCALE[latest.mood - 1]?.label}, ${ENERGY_SCALE[latest.energy - 1]?.label.toLowerCase()}.` : 'A quick mood and energy check-in. Trends appear in Journal.'}>
      <div className="px-3 py-3">
        <p className="ios-footnote mb-2 px-1 text-ink-subtle">{mood ? 'Energy' : 'Mood'}</p>
        <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={mood ? 'Energy' : 'Mood'}>
          {(mood ? ENERGY_SCALE : MOOD_SCALE).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => {
                if (!mood) return setMood(o.value)
                actions.create('checkIns', { date, at: date === today ? new Date().toISOString() : `${date}T12:00:00.000Z`, mood, energy: o.value })
                setMood(undefined)
                toast({ title: 'Check-in saved' })
              }}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-[var(--ios-fill)] active:opacity-60"
            >
              <span className="text-[20px] leading-none">{'emoji' in o ? o.emoji : o.value}</span>
              <span className="text-[11px] leading-tight text-ink-subtle">{o.label}</span>
            </button>
          ))}
        </div>
        {mood && (
          <button type="button" className="ios-footnote mt-2 px-1 text-accent" onClick={() => setMood(undefined)}>
            Change mood ({MOOD_SCALE[mood - 1].emoji})
          </button>
        )}
      </div>
    </Section>
  )
}

