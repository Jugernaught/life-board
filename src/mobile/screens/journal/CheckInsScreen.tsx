/**
 * Mood & energy trend. Kept in its own module so the chart library loads only
 * when this screen opens, not with the Journal tab.
 */
import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ENERGY_SCALE, MOOD_SCALE } from '@/data/constants'
import { useToday } from '@/hooks/useNow'
import { addDaysISO, eachDay, formatDate } from '@/lib/dates'
import { average } from '@/lib/utils'
import { useCollection } from '@/store/store'
import { ChartCard, ChartTooltip, axisProps, gridProps, series } from '@/components/charts/ChartKit'
import { deleteRecord } from '@/components/editor/useDeleteRecord'
import { Cell, EmptyRow, Section } from '../../ui/List'
import { SwipeRow } from '../../ui/SwipeRow'
import { Screen } from '../../ui/Screen'

export function CheckInsScreen() {
  const checkIns = useCollection('checkIns')
  const today = useToday()
  const data = useMemo(
    () =>
      eachDay(addDaysISO(today, -29), today).map((d) => {
        const list = checkIns.filter((c) => c.date === d)
        return { date: d, mood: list.length ? Math.round(average(list.map((c) => c.mood)) * 10) / 10 : null, energy: list.length ? Math.round(average(list.map((c) => c.energy)) * 10) / 10 : null }
      }),
    [checkIns, today],
  )
  const recent = [...checkIns].sort((a, b) => (a.at < b.at ? 1 : -1))
  return (
    <Screen title="Mood & Energy" testId="screen-checkins">
      <div className="mx-4 mb-7">
        <ChartCard
          title="Last 30 days"
          description="Daily average · 1 (low) to 5 (high)"
          legend={[
            { label: 'Mood', color: series(1) },
            { label: 'Energy', color: series(4) },
          ]}
          rows={data.filter((d) => d.mood !== null)}
          columns={[
            { label: 'Date', value: (r) => formatDate(r.date, 'EEE d MMM') },
            { label: 'Mood', value: (r) => r.mood, align: 'right' },
            { label: 'Energy', value: (r) => r.energy, align: 'right' },
          ]}
          empty={!data.some((d) => d.mood !== null)}
          emptyHint="Check in from Today or Journal to see your trend."
          height={200}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, 'd MMM')} {...axisProps} minTickGap={30} />
              <YAxis domain={[1, 5]} ticks={[1, 3, 5]} {...axisProps} />
              <Tooltip content={(p) => <ChartTooltip {...(p as object)} formatValue={(v) => `${v}/5`} formatLabel={(l) => formatDate(String(l), 'EEE d MMM')} />} />
              <Line type="monotone" dataKey="mood" name="Mood" stroke={series(1)} strokeWidth={2} dot={{ r: 3, fill: series(1), strokeWidth: 0 }} connectNulls />
              <Line type="monotone" dataKey="energy" name="Energy" stroke={series(4)} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: series(4), strokeWidth: 0 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <Section header="All check-ins">
        {recent.length === 0 && <EmptyRow>No check-ins yet.</EmptyRow>}
        {recent.slice(0, 200).map((c) => (
          <SwipeRow key={c.id} actions={[{ label: 'Delete', icon: Trash2, tone: 'bad', onAction: () => void deleteRecord('checkIns', c.id) }]}>
            <Cell
              title={`${MOOD_SCALE[c.mood - 1]?.emoji} ${MOOD_SCALE[c.mood - 1]?.label} · ${ENERGY_SCALE[c.energy - 1]?.label}`}
              subtitle={c.note}
              detail={<span className="ios-footnote">{new Date(c.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
            />
          </SwipeRow>
        ))}
      </Section>
    </Screen>
  )
}
