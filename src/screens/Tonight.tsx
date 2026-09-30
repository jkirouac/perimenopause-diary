import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  COMPARED,
  SECTIONS,
  SEVERITY,
  SEVERITY_LEGEND,
  bmi,
  noneValue,
  parseBp,
  sectionOf,
  type DiaryRow,
} from '../lib/diary'
import { addDays, isNightNow, longDate, useToday } from '../lib/dates'
import type { Extra } from '../lib/store'
import { useEntries } from '../lib/useEntries'
import { InstallBanner } from './Install'
import { SectionIcon } from './SectionIcon'

type SetValue = (value: string | null, extra?: Extra | null) => void

export function Tonight({ rows, heightIn }: { rows: DiaryRow[]; heightIn: number | null }) {
  const t = useToday()
  const y = addDays(t, -1)
  const [which, setWhich] = useState<'today' | 'yesterday'>('today')
  // Coming back on a new day always starts on the new day.
  const [shownFor, setShownFor] = useState(t)
  if (shownFor !== t) {
    setShownFor(t)
    setWhich('today')
  }
  const date = which === 'today' ? t : y
  const setDate = (d: string) => setWhich(d === t ? 'today' : 'yesterday')
  const { entries, error, setValue, setComment } = useEntries(y, t)

  const visible = rows.filter((r) => !r.hidden)
  const day = entries?.values[date] ?? {}
  const extras = entries?.extras[date] ?? {}
  // Medications and measurements aren't expected every day, so they don't count here.
  const scored = visible.filter((r) => noneValue(r.scale) !== null)
  const filled = scored.filter((r) => day[r.id] !== undefined).length
  const left = scored.filter((r) => day[r.id] === undefined && noneValue(r.scale) !== null)

  function markRestNone() {
    for (const r of left) setValue(date, r.id, noneValue(r.scale))
  }

  const night = isNightNow()
  const flushRow = visible.find((r) => r.key === (night ? 'flush_night_n' : 'flush_day_n'))
  // The severity legend goes above the first severity section on screen.
  const firstSeverity = SECTIONS.find((s) => s.severity && visible.some((r) => sectionOf(r) === s.id))?.id

  return (
    <main className="screen">
      <InstallBanner />
      <header className="day-head">
        <div className="seg" role="group" aria-label="Which day">
          <button aria-pressed={date === t} onClick={() => setDate(t)}>
            Today
          </button>
          <button aria-pressed={date === y} onClick={() => setDate(y)}>
            Yesterday
          </button>
        </div>
        <h1>
          How was <em className="emph">{date === t ? 'today' : 'yesterday'}</em>?
        </h1>
        <p className="day-date">{longDate(date)}</p>
        <p className="muted">
          {filled} of {scored.length} filled
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
                  Adds one to {night ? 'night' : 'day'} flushes · today:{' '}
                  {day[flushRow.id] ?? '–'}
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
            const sectionRows = visible.filter((r) => sectionOf(r) === section.id)
            if (sectionRows.length === 0) return null
            const legend = section.id === firstSeverity ? SEVERITY_LEGEND : section.legend
            return (
              <section key={section.id} className="section">
                <h2 className="section-title">
                  <SectionIcon id={section.id} />
                  {section.title}
                </h2>
                {legend && <p className="legend">{legend}</p>}
                <ul className="rows">
                  {sectionRows.map((r) => (
                    <li key={`${date}-${r.id}`}>
                      <RowInput
                        row={r}
                        value={day[r.id]}
                        extra={extras[r.id]}
                        heightIn={heightIn}
                        set={(v, x) => setValue(date, r.id, v, x)}
                      />
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

interface RowProps {
  row: DiaryRow
  value: string | undefined
  extra?: Extra
  heightIn: number | null
  set: SetValue
}

function RowInput({ row, value, extra, heightIn, set }: RowProps) {
  switch (row.scale) {
    case '0-4':
      return (
        <div className="row row-sev">
          <span className="row-label">{wrapAtSlash(row.label)}</span>
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
          <span className="row-label">{wrapAtSlash(row.label)}</span>
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
          <span className="row-label">{wrapAtSlash(row.label)}</span>
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
      return <MedInput row={row} value={value} extra={extra} set={set} />
    case 'number':
      return (
        <NumberInput row={row} value={value} set={set}>
          {row.key === 'weight' && <Bmi value={value} heightIn={heightIn} />}
        </NumberInput>
      )
    case 'bp':
      return <BpInput row={row} value={value} extra={extra} set={set} />
  }
}

// Saves a text field shortly after typing stops, and straight away if the app is
// put in the background or closed, when a phone may never fire the field's blur.
function useSaveWhileTyping(text: string, dirty: boolean, commit: () => void) {
  const latest = useRef({ dirty, commit })
  useLayoutEffect(() => {
    latest.current = { dirty, commit }
  })
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => latest.current.commit(), 800)
    return () => clearTimeout(timer)
  }, [text, dirty])
  useEffect(() => {
    const saveNow = () => latest.current.dirty && latest.current.commit()
    const onHidden = () => document.visibilityState === 'hidden' && saveNow()
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', saveNow)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', saveNow)
      saveNow() // Leaving the screen, or switching between Today and Yesterday.
    }
  }, [])
}

function NumberInput({
  row,
  value,
  set,
  children,
}: {
  row: DiaryRow
  value: string | undefined
  set: SetValue
  children?: ReactNode
}) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const id = `num-${row.id}`
  const typed = text.trim().replace(',', '.')
  const dirty = typed !== (value ?? '')
  const commit = () => set(typed === '' ? null : typed)
  useSaveWhileTyping(text, dirty, commit)
  return (
    <div>
      <div className="row row-inline">
        <label className="row-label" htmlFor={id}>
          {wrapAtSlash(row.label)}
        </label>
        <input
          id={id}
          className="num"
          inputMode="decimal"
          maxLength={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => dirty && commit()}
        />
      </div>
      {children}
    </div>
  )
}

function Bmi({ value, heightIn }: { value: string | undefined; heightIn: number | null }) {
  const pounds = Number(value)
  if (!value || !(pounds > 0)) return null
  return (
    <p className="muted small row-sub">
      {heightIn ? `BMI ${bmi(pounds, heightIn)}` : 'Add your height in Settings to see your BMI.'}
    </p>
  )
}

// A medication or supplement: taken or not, with its usual dose and notes shown,
// and once taken, an optional time and a dose for today if it differs.
function MedInput({ row, value, extra, set }: Omit<RowProps, 'heightIn'>) {
  const taken = value === '1'
  const usual = [row.dose, row.notes].filter(Boolean).join(' · ')
  return (
    <div className="med">
      <div className="row row-inline">
        <span className="row-label">
          {wrapAtSlash(row.label)}
          {usual && <small className="row-sub">{usual}</small>}
        </span>
        <button className="tick" aria-pressed={taken} onClick={() => set(taken ? null : '1')}>
          {taken ? '✓ Taken' : 'Not taken'}
        </button>
      </div>
      {taken && <MedDetails row={row} extra={extra} set={set} />}
    </div>
  )
}

function MedDetails({ row, extra, set }: { row: DiaryRow; extra?: Extra; set: SetValue }) {
  const [dose, setDose] = useState(extra?.dose ?? '')
  const dirty = dose.trim() !== (extra?.dose ?? '')
  const commit = () => set('1', { ...extra, dose })
  useSaveWhileTyping(dose, dirty, commit)
  return (
    <div className="med-details">
      <label>
        <span>Time</span>
        <input
          type="time"
          aria-label={`Time you took ${row.label}`}
          value={extra?.time ?? ''}
          onChange={(e) => set('1', { ...extra, dose, time: e.target.value })}
        />
      </label>
      <label>
        <span>Dose today, if different</span>
        <input
          aria-label={`Dose of ${row.label} today`}
          maxLength={80}
          value={dose}
          placeholder={row.dose || 'Usual dose'}
          onChange={(e) => setDose(e.target.value)}
          onBlur={() => dirty && commit()}
        />
      </label>
    </div>
  )
}

// Blood pressure: the top and bottom numbers, saved together as "120/80", with an optional time.
function BpInput({ row, value, extra, set }: Omit<RowProps, 'heightIn'>) {
  const saved = parseBp(value)
  const [top, setTop] = useState(saved ? String(saved.top) : '')
  const [bottom, setBottom] = useState(saved ? String(saved.bottom) : '')
  const [time, setTime] = useState(extra?.time ?? '')
  const both = top.trim() !== '' && bottom.trim() !== ''
  const neither = top.trim() === '' && bottom.trim() === ''
  const typed = both ? `${top.trim()}/${bottom.trim()}` : ''
  const looksWrong = both && parseBp(typed) === null
  const ready = (both && !looksWrong) || neither
  const dirty = ready && (typed !== (value ?? '') || (typed !== '' && time !== (extra?.time ?? '')))
  const commit = () => set(typed || null, typed ? { time } : null)
  useSaveWhileTyping(`${top}/${bottom}@${time}`, dirty, commit)
  const onBlur = () => dirty && commit()
  return (
    <div>
      <div className="row row-inline">
        <span className="row-label">{wrapAtSlash(row.label)}</span>
        <div className="bp">
          <input
            className="num"
            inputMode="numeric"
            aria-label="Top number (systolic)"
            placeholder="120"
            value={top}
            onChange={(e) => setTop(e.target.value.replace(/D/g, ''))}
            onBlur={onBlur}
          />
          <span aria-hidden="true">/</span>
          <input
            className="num"
            inputMode="numeric"
            aria-label="Bottom number (diastolic)"
            placeholder="80"
            value={bottom}
            onChange={(e) => setBottom(e.target.value.replace(/D/g, ''))}
            onBlur={onBlur}
          />
        </div>
      </div>
      <div className="med-details">
        <label>
          <span>Time</span>
          <input
            type="time"
            aria-label="Time you measured your blood pressure"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={onBlur}
          />
        </label>
      </div>
      {looksWrong && <p className="error small">Those numbers look off. Blood pressure is written like 120 / 80.</p>}
    </div>
  )
}

function Comment({ initial, save }: { initial: string; save: (t: string) => void }) {
  const [text, setText] = useState(initial)
  const dirty = text !== initial
  const commit = () => save(text)
  useSaveWhileTyping(text, dirty, commit)
  return (
    <section className="section">
      <h2>
        <label htmlFor="comment">Comments</label>
      </h2>
      <p className="legend">Anything that shaped the day: illness, an argument, good news, a late night.</p>
      <textarea
        id="comment"
        maxLength={2000}
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => dirty && commit()}
      />
    </section>
  )
}

// Lets names like "Vaginal pain/dryness" wrap after the slash instead of mid-word.
function wrapAtSlash(label: string): ReactNode {
  const parts = label.split('/')
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ))
}
