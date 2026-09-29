import { useState } from 'react'
import type { DiaryRow } from '../lib/diary'
import { addDays, parseDay, today } from '../lib/dates'
import { useEntries } from '../lib/useEntries'
import type { Entries } from '../lib/store'

const W = 320
const H = 64
const PAD = 4
const CMP_Y: Record<string, number> = { M: -2, L: -1, U: 0, Y: 1, Z: 2 }

export function Trends({ rows }: { rows: DiaryRow[] }) {
  const [span, setSpan] = useState(30)
  const to = today()
  const from = addDays(to, -(span - 1))
  const { entries, error } = useEntries(from, to)
  const days = Array.from({ length: span }, (_, i) => addDays(from, i))

  const visible = rows.filter((r) => !r.hidden)
  const hasData = (r: DiaryRow) => entries && days.some((d) => entries.values[d]?.[r.id] !== undefined)
  const treatments = visible.filter((r) => r.scale === 'tick' && hasData(r))
  const charted = visible.filter((r) => r.scale !== 'tick' && r.scale !== 'number' && hasData(r))

  return (
    <main className="screen">
      <header className="day-head">
        <div className="seg" role="group" aria-label="Time span">
          {[30, 90].map((n) => (
            <button key={n} aria-pressed={span === n} onClick={() => setSpan(n)}>
              {n === 30 ? 'Last 30 days' : 'Last 3 months'}
            </button>
          ))}
        </div>
        <h1>Trends</h1>
        <p className="muted">
          {parseDay(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
          {parseDay(to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}. Gaps are days not
          recorded.
        </p>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      {!entries && !error && <p className="muted">Loading…</p>}
      {entries && charted.length === 0 && <p className="muted">Nothing recorded in this period yet.</p>}
      {entries && (
        <div className="trends">
          {treatments.map((r) => (
            <TreatmentStrip key={r.id} row={r} days={days} entries={entries} />
          ))}
          {charted.map((r) => (
            <Spark key={r.id} row={r} days={days} entries={entries} treatments={treatments} />
          ))}
        </div>
      )}
    </main>
  )
}

function dayCount(n: number) {
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

function x(i: number, n: number) {
  return PAD + (i * (W - PAD * 2)) / Math.max(n - 1, 1)
}

function TreatmentStrip({ row, days, entries }: { row: DiaryRow; days: string[]; entries: Entries }) {
  const taken = days.filter((d) => entries.values[d]?.[row.id] === '1').length
  return (
    <figure className="spark treatment">
      <figcaption>
        <span>{row.label}</span>
        <span className="muted small">taken {dayCount(taken)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} 14`} role="img" aria-label={`${row.label}: taken on ${taken} days`}>
        <line x1={PAD} x2={W - PAD} y1={7} y2={7} className="axis" />
        {days.map((d, i) =>
          entries.values[d]?.[row.id] === '1' ? <circle key={d} cx={x(i, days.length)} cy={7} r={3.5} className="dose" /> : null,
        )}
      </svg>
    </figure>
  )
}

function Spark({
  row,
  days,
  entries,
  treatments,
}: {
  row: DiaryRow
  days: string[]
  entries: Entries
  treatments: DiaryRow[]
}) {
  const isCmp = row.scale === 'MLUYZ'
  const nums = days.map((d) => {
    const v = entries.values[d]?.[row.id]
    if (v === undefined) return null
    return isCmp ? CMP_Y[v] ?? null : Number(v)
  })
  const present = nums.filter((v): v is number => v !== null)
  const lo = isCmp ? -2 : 0
  const hi = isCmp ? 2 : Math.max(4, ...present)
  const y = (v: number) => H - PAD - ((v - lo) * (H - PAD * 2)) / (hi - lo)

  // Break the line where a day wasn't recorded.
  const segments: string[] = []
  let current = ''
  nums.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current)
      current = ''
    } else {
      current += `${current ? 'L' : 'M'}${x(i, days.length).toFixed(1)},${y(v).toFixed(1)}`
    }
  })
  if (current) segments.push(current)

  const avg = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0
  const treatmentDays = new Set(
    days.filter((d) => treatments.some((t) => entries.values[d]?.[t.id] === '1')),
  )

  return (
    <figure className="spark">
      <figcaption>
        <span>{row.label}</span>
        <span className="muted small">
          {isCmp ? dayCount(present.length) : `average ${avg.toFixed(1)} · ${dayCount(present.length)}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${row.label} over ${days.length} days`}>
        {days.map((d, i) =>
          treatmentDays.has(d) ? (
            <line key={d} x1={x(i, days.length)} x2={x(i, days.length)} y1={PAD} y2={H - PAD} className="dose-line" />
          ) : null,
        )}
        <line x1={PAD} x2={W - PAD} y1={y(isCmp ? 0 : lo)} y2={y(isCmp ? 0 : lo)} className="axis" />
        {segments.map((s, i) => (
          <path key={i} d={s} className="trend" />
        ))}
        {nums.map((v, i) =>
          v === null ? null : <circle key={i} cx={x(i, days.length)} cy={y(v)} r={2} className="pt" />,
        )}
      </svg>
      {isCmp && <span className="spark-scale muted small">above the line = more than usual</span>}
    </figure>
  )
}
