import { useEffect, useState } from 'react'
import { COMPARED, SECTIONS, SEVERITY, noneValue, type DiaryRow } from '../lib/diary'
import { addDays, isNightNow, longDate, today } from '../lib/dates'
import { useEntries } from '../lib/useEntries'

type SetValue = (value: string | null) => void

export function Tonight({ rows }: { rows: DiaryRow[] }) {
  const t = today()
  const y = addDays(t, -1)
  const [date, setDate] = useState(t)
  const { entries, error, setValue, setComment } = useEntries(y, t)

  const visible = rows.filter((r) => !r.hidden)
  const day = entries?.values[date] ?? {}
  const scored = visible.filter((r) => r.scale !== 'tick' && r.scale !== 'number')
  const filled = scored.filter((r) => day[r.id] !== undefined).length
  const left = scored.filter((r) => day[r.id] === undefined && noneValue(r.scale) !== null)

  function markRestNone() {
    for (const r of left) setValue(date, r.id, noneValue(r.scale))
  }

  const flushRow = visible.find((r) => r.key === (isNightNow() ? 'flush_night_n' : 'flush_day_n'))

  return (
    <main className="screen">
      <header className="day-head">
        <div className="seg" role="group" aria-label="Which day">
          <button aria-pressed={date === t} onClick={() => setDate(t)}>
            Today
          </button>
          <button aria-pressed={date === y} onClick={() => setDate(y)}>
            Yesterday
          </button>
        </div>
        <h1>{longDate(date)}</h1>
        <p className="muted">
          {filled} of {scored.length} filled
          {date === y && ' · catching up on yesterday'}
        </p>
      </header>

      {error && <p className="error" role="alert">{error}</p>}
      {!entries && !error && <p className="muted">Loading…</p>}

      {entries && (
        <>
          {date === t && flushRow && (
            <div className="flush-card">
              <div>
                <strong>Hot flush just now?</strong>
                <span className="muted">
                  Adds one to {flushRow.label.replace('# of flushes – ', '')} flushes · today:{' '}
                  {day[flushRow.id] ?? 0}
                </span>
              </div>
              <button
                className="primary"
                onClick={() => setValue(date, flushRow.id, String(Number(day[flushRow.id] ?? 0) + 1))}
              >
                +1
              </button>
            </div>
          )}

          {SECTIONS.map((section) => {
            const sectionRows = visible.filter((r) => section.scales.includes(r.scale))
            if (sectionRows.length === 0) return null
            return (
              <section key={section.title} className="section">
                <h2>{section.title}</h2>
                {section.legend && <p className="legend">{section.legend}</p>}
                <ul className="rows">
                  {sectionRows.map((r) => (
                    <li key={r.id}>
                      <RowInput row={r} value={day[r.id]} set={(v) => setValue(date, r.id, v)} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {left.length > 0 && (
            <button className="wide" onClick={markRestNone}>
              Mark the other {left.length} as none (0, or U for usual)
            </button>
          )}

          <Comment
            key={date}
            initial={entries.comments[date] ?? ''}
            save={(text) => setComment(date, text)}
          />
          <p className="muted small">Saved as you go. Blank means not recorded; 0 means you had none.</p>
        </>
      )}
    </main>
  )
}

function RowInput({ row, value, set }: { row: DiaryRow; value: string | undefined; set: SetValue }) {
  switch (row.scale) {
    case '0-4':
      return (
        <div className="row row-sev">
          <span className="row-label">{row.label}</span>
          <div className="choices" role="group" aria-label={row.label}>
            {SEVERITY.map((s) => (
              <button
                key={s.value}
                className={`choice sev-${s.value}`}
                aria-pressed={value === s.value}
                aria-label={`${s.value}, ${s.word}`}
                onClick={() => set(value === s.value ? null : s.value)}
              >
                {s.value}
              </button>
            ))}
          </div>
        </div>
      )
    case 'MLUYZ':
      return (
        <div className="row">
          <span className="row-label">{row.label}</span>
          <div className="choices" role="group" aria-label={row.label}>
            {COMPARED.map((c) => (
              <button
                key={c.value}
                className={`choice cmp cmp-${c.value}`}
                aria-pressed={value === c.value}
                aria-label={c.word}
                onClick={() => set(value === c.value ? null : c.value)}
              >
                {c.value}
                <small>{c.word}</small>
              </button>
            ))}
          </div>
        </div>
      )
    case 'count': {
      const n = value === undefined ? null : Number(value)
      return (
        <div className="row row-inline">
          <span className="row-label">{row.label}</span>
          <div className="stepper">
            <button aria-label="One fewer" disabled={n === null} onClick={() => set(n && n > 0 ? String(n - 1) : n === 0 ? null : '0')}>
              −
            </button>
            <output aria-live="polite">{n === null ? '–' : n}</output>
            <button aria-label="One more" onClick={() => set(String((n ?? 0) + 1))}>
              +
            </button>
          </div>
        </div>
      )
    }
    case 'tick':
      return (
        <div className="row row-inline">
          <span className="row-label">{row.label}</span>
          <button className="tick" aria-pressed={value === '1'} onClick={() => set(value === '1' ? null : '1')}>
            {value === '1' ? '✓ Taken' : 'Not taken'}
          </button>
        </div>
      )
    case 'number':
      return <NumberInput row={row} value={value} set={set} />
  }
}

function NumberInput({ row, value, set }: { row: DiaryRow; value: string | undefined; set: SetValue }) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const id = `num-${row.id}`
  return (
    <div className="row row-inline">
      <label className="row-label" htmlFor={id}>
        {row.label}
      </label>
      <input
        id={id}
        className="num"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = text.trim().replace(',', '.')
          if (v === (value ?? '')) return
          set(v === '' ? null : v)
        }}
      />
    </div>
  )
}

function Comment({ initial, save }: { initial: string; save: (t: string) => void }) {
  const [text, setText] = useState(initial)
  return (
    <section className="section">
      <h2>
        <label htmlFor="comment">Comments</label>
      </h2>
      <p className="legend">Anything that shaped the day: illness, an argument, good news, a late night.</p>
      <textarea
        id="comment"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== initial && save(text)}
      />
    </section>
  )
}
