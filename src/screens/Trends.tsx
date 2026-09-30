import { useState } from 'react'
import { bmi, parseBp, type DiaryRow } from '../lib/diary'
import { addDays, parseDay, useToday } from '../lib/dates'
import { useEntries } from '../lib/useEntries'
import type { Entries } from '../lib/store'

const W = 320
const H = 64
const PAD = 4
const CMP_Y: Record<string, number> = { M: -2, L: -1, U: 0, Y: 1, Z: 2 }

export function Trends({ rows, heightIn }: { rows: DiaryRow[]; heightIn: number | null }) {
  const [span, setSpan] = useState(30)
  const to = useToday()
  const from = addDays(to, -(span - 1))
  const { entries, error } = useEntries(from, to)
  const days = Array.from({ length: span }, (_, i) => addDays(from, i))

  const visible = rows.filter((r) => !r.hidden)
  const hasData = (r: DiaryRow) => entries && days.some((d) => entries.values[d]?.[r.id] !== undefined)
  const treatments = visible.filter((r) => r.scale === 'tick' && hasData(r))
  const charted = visible.filter((r) => r.scale !== 'tick' && hasData(r))

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
      {entries && charted.length === 0 && treatments.length === 0 && (
        <p className="muted">Nothing recorded in this period yet.</p>
      )}
      {entries && (
        <div className="trends">
          {treatments.map((r) => (
            <TreatmentStrip key={r.id} row={r} days={days} entries={entries} />
          ))}
          {charted.map((r) => (
            <Spark key={r.id} row={r} days={days} entries={entries} treatments={treatments} heightIn={heightIn} />
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

// One line per series; blood pressure has two (top and bottom numbers).
function seriesFor(row: DiaryRow, days: string[], entries: Entries): (number | null)[][] {
  const raw = days.map((d) => entries.values[d]?.[row.id])
  if (row.scale === 'bp') {
    const bp = raw.map(parseBp)
    return [bp.map((v) => v?.top ?? null), bp.map((v) => v?.bottom ?? null)]
  }
  if (row.scale === 'MLUYZ') return [raw.map((v) => (v === undefined ? null : (CMP_Y[v] ?? null)))]
  return [raw.map((v) => (v === undefined || Number.isNaN(Number(v)) ? null : Number(v)))]
}

function Spark({
  row,
  days,
  entries,
  treatments,
  heightIn,
}: {
  row: DiaryRow
  days: string[]
  entries: Entries
  treatments: DiaryRow[]
  heightIn: number | null
}) {
  const isCmp = row.scale === 'MLUYZ'
  const isMeasure = row.scale === 'number' || row.scale === 'bp'
  const series = seriesFor(row, days, entries)
  const present = series.flat().filter((v): v is number => v !== null)
  const recorded = series[0].filter((v) => v !== null).length

  // Strength rows start at 0; measurements use their own range so changes show.
  let lo = isCmp ? -2 : 0
  let hi = isCmp ? 2 : Math.max(4, ...present)
  if (isMeasure) {
    lo = Math.min(...present)
    hi = Math.max(...present)
    const pad = Math.max((hi - lo) * 0.15, 1)
    lo -= pad
    hi += pad
  }
  const y = (v: number) => H - PAD - ((v - lo) * (H - PAD * 2)) / (hi - lo)

  // Break the line where a day wasn't recorded.
  const paths = series.map((nums) => {
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
    return segments
  })

  const avg = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0
  const latestDay = [...days].reverse().find((d) => entries.values[d]?.[row.id] !== undefined)
  const latest = latestDay ? entries.values[latestDay][row.id] : ''
  let caption = `average ${avg.toFixed(1)} · ${dayCount(recorded)}`
  if (isCmp) caption = dayCount(recorded)
  if (isMeasure) caption = `latest ${latest} · ${dayCount(recorded)}`
  if (row.key === 'weight' && heightIn && Number(latest) > 0) {
    caption = `latest ${latest} lb · BMI ${bmi(Number(latest), heightIn)} · ${dayCount(recorded)}`
  }

  const treatmentDays = new Set(days.filter((d) => treatments.some((t) => entries.values[d]?.[t.id] === '1')))

  return (
    <figure className="spark">
      <figcaption>
        <span>{row.label}</span>
        <span className="muted small">{caption}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${row.label} over ${days.length} days`}>
        {days.map((d, i) =>
          treatmentDays.has(d) ? (
            <line key={d} x1={x(i, days.length)} x2={x(i, days.length)} y1={PAD} y2={H - PAD} className="dose-line" />
          ) : null,
        )}
        {!isMeasure && <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} className="axis" />}
        {paths.map((segments, s) =>
          segments.map((d, i) => <path key={`${s}-${i}`} d={d} className="trend" />),
        )}
        {series.map((nums, s) =>
          nums.map((v, i) =>
            v === null ? null : <circle key={`${s}-${i}`} cx={x(i, days.length)} cy={y(v)} r={2} className="pt" />,
          ),
        )}
      </svg>
      {isCmp && <span className="spark-scale muted small">above the line = more than usual</span>}
      {row.scale === 'bp' && <span className="spark-scale muted small">top and bottom numbers</span>}
    </figure>
  )
}
