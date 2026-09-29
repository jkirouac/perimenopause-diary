import { SECTIONS, type DiaryRow } from '../lib/diary'
import { daysInMonth, isoDay } from '../lib/dates'
import type { Entries } from '../lib/store'

// The paper diary's grid: rows down the side, days of the month across.
export function MonthGrid({
  rows,
  entries,
  year,
  month,
}: {
  rows: DiaryRow[]
  entries: Entries
  year: number
  month: number
}) {
  const n = daysInMonth(year, month)
  const days = Array.from({ length: n }, (_, i) => isoDay(new Date(year, month, i + 1)))
  // Hidden rows still show if they have something recorded this month.
  // Grouped by section like Tonight, keeping each section's own order.
  const shown = SECTIONS.flatMap((s) =>
    rows.filter(
      (r) =>
        s.scales.includes(r.scale) && (!r.hidden || days.some((d) => entries.values[d]?.[r.id] !== undefined)),
    ),
  )
  const sectionOf = (r: DiaryRow) => SECTIONS.findIndex((s) => s.scales.includes(r.scale))

  return (
    <div className="grid-scroll">
      <table className="month-grid">
        <thead>
          <tr>
            <th scope="col" className="corner">
              Day
            </th>
            {days.map((d, i) => (
              <th scope="col" key={d}>
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={r.id} className={i > 0 && sectionOf(shown[i - 1]) !== sectionOf(r) ? 'group-start' : ''}>
              <th scope="row">{r.label}</th>
              {days.map((d) => {
                const v = entries.values[d]?.[r.id]
                return (
                  <td key={d} className={cellClass(r, v)}>
                    {v === undefined ? '' : r.scale === 'tick' ? '✓' : v}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="group-start">
            <th scope="row">Comments</th>
            {days.map((d) => (
              <td key={d} className={entries.comments[d] ? 'has-comment' : ''}>
                {entries.comments[d] ? <span title={entries.comments[d]}>•</span> : ''}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function cellClass(r: DiaryRow, v: string | undefined) {
  if (v === undefined) return 'blank'
  if (r.scale === '0-4') return `sev-${v}`
  if (r.scale === 'MLUYZ') return `cmp-${v}`
  if (r.scale === 'tick') return 'ticked'
  return ''
}

export function CommentList({ entries, days }: { entries: Entries; days: string[] }) {
  const list = days.filter((d) => entries.comments[d])
  if (list.length === 0) return <p className="muted small">No comments this month.</p>
  return (
    <dl className="comments">
      {list.map((d) => (
        <div key={d}>
          <dt>{Number(d.slice(8))}</dt>
          <dd>{entries.comments[d]}</dd>
        </div>
      ))}
    </dl>
  )
}
