import { useState } from 'react'
import type { DiaryRow } from '../lib/diary'
import { daysInMonth, isoDay, monthName, monthRange, parseDay, useToday } from '../lib/dates'
import { useEntries } from '../lib/useEntries'
import { CommentList, MonthGrid } from './MonthGrid'

export function useMonth() {
  const now = parseDay(useToday())
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const step = (delta: number) =>
    setYm(({ year, month }) => {
      const d = new Date(year, month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  const isCurrent = ym.year === now.getFullYear() && ym.month === now.getMonth()
  return { ...ym, step, isCurrent }
}

export function MonthNav({ year, month, step, isCurrent }: ReturnType<typeof useMonth>) {
  return (
    <div className="month-nav">
      <button onClick={() => step(-1)} aria-label="Previous month">
        ‹
      </button>
      <h1>{monthName(year, month)}</h1>
      <button onClick={() => step(1)} aria-label="Next month" disabled={isCurrent}>
        ›
      </button>
    </div>
  )
}

export function Month({ rows }: { rows: DiaryRow[] }) {
  const m = useMonth()
  const { from, to } = monthRange(m.year, m.month)
  const { entries, error } = useEntries(from, to)
  const days = Array.from({ length: daysInMonth(m.year, m.month) }, (_, i) => isoDay(new Date(m.year, m.month, i + 1)))

  return (
    <main className="screen wide-screen">
      <MonthNav {...m} />
      {error && <p className="error" role="alert">{error}</p>}
      {!entries && !error && <p className="muted">Loading…</p>}
      {entries && (
        <>
          <MonthGrid rows={rows} entries={entries} year={m.year} month={m.month} />
          <p className="muted small">Swipe the grid sideways to see the whole month. Darker means stronger.</p>
          <section className="section">
            <h2>Comments</h2>
            <CommentList entries={entries} days={days} />
          </section>
        </>
      )}
    </main>
  )
}
