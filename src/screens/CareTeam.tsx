import { COMPARED, CREDIT, SEVERITY, type DiaryRow } from '../lib/diary'
import { daysInMonth, isoDay, monthName, monthRange } from '../lib/dates'
import { useEntries } from '../lib/useEntries'
import { CommentList, MonthGrid } from './MonthGrid'
import { MonthNav, useMonth } from './Month'

// A printable copy of the month for whoever supports her care: her nurse practitioner,
// doctor, midwife or anyone else. Never name just one profession (DESIGN.md, Voice).
export function CareTeam({ rows, name }: { rows: DiaryRow[]; name: string }) {
  const m = useMonth()
  const { from, to } = monthRange(m.year, m.month)
  const { entries, error } = useEntries(from, to)
  const days = Array.from({ length: daysInMonth(m.year, m.month) }, (_, i) => isoDay(new Date(m.year, m.month, i + 1)))

  return (
    <main className="screen wide-screen">
      <div className="no-print stack">
        <MonthNav {...m} />
        <h2>For your care team</h2>
        <p>
          A one-page copy of this month, laid out like the CeMCOR paper diary, for your nurse practitioner, doctor,
          midwife or anyone who supports your care. Print it, or choose <strong>Save as PDF</strong> in the print
          screen to email it. Nothing is sent from the app.
        </p>
        <button className="primary" onClick={() => window.print()} disabled={!entries}>
          Print or save as PDF
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {entries && (
        <article className="sheet">
          <header className="sheet-head">
            <h2>Daily Perimenopause Diary</h2>
            <p>
              {name ? <strong>{name}</strong> : null}
              {name ? ' · ' : ''}
              {monthName(m.year, m.month)} · calendar days
            </p>
          </header>
          <MonthGrid rows={rows} entries={entries} year={m.year} month={m.month} />
          <p className="sheet-legend">
            <strong>Strength:</strong> {SEVERITY.map((s) => `${s.value} ${s.word}`).join(', ')}.{' '}
            <strong>Compared with usual:</strong> {COMPARED.map((c) => `${c.value} ${c.word}`).join(', ')}.{' '}
            <strong>Blank:</strong> not recorded. <strong>✓</strong> taken. <strong>Blood pressure:</strong> top/bottom number.
          </p>
          <h3>Comments</h3>
          <CommentList entries={entries} days={days} />
          <p className="credit">{CREDIT}</p>
        </article>
      )}
    </main>
  )
}
