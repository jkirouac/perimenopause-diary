import { useEffect, useState, type FormEvent } from 'react'
import {
  CREDIT,
  SCALE_NAMES,
  SECTIONS,
  SYMPTOM_GROUPS,
  sectionOf,
  sectionTitle,
  type Category,
  type DiaryRow,
  type Scale,
} from '../lib/diary'
import { today } from '../lib/dates'
import {
  addRow,
  clearLocal,
  deleteRow,
  flush,
  loadEntries,
  pendingCount,
  saveHeight,
  saveName,
  sendFeedback,
  updateRow,
  type Extra,
} from '../lib/store'
import { supabase } from '../lib/supabase'
import { setThemePref, themePref, type ThemePref } from '../lib/theme'
import { InstallCard } from './Install'

interface Props {
  rows: DiaryRow[]
  name: string
  heightIn: number | null
  email: string
  onRowsChanged: () => void
  onNameChanged: (name: string) => void
  onHeightChanged: (heightIn: number | null) => void
}

export function Settings({ rows, name, heightIn, email, onRowsChanged, onNameChanged, onHeightChanged }: Props) {
  const [error, setError] = useState('')

  async function run(action: () => Promise<void>) {
    setError('')
    try {
      await action()
      onRowsChanged()
    } catch {
      setError("Couldn't save that change. Check your connection and try again.")
    }
  }

  // Moves a row past its neighbour in the same section, the order the screens show.
  function move(list: DiaryRow[], row: DiaryRow, dir: -1 | 1) {
    const i = list.findIndex((r) => r.id === row.id)
    const other = list[i + dir]
    if (!other) return
    // Two rows added in quick succession can share a sort number; swapping equal
    // numbers would change nothing, so nudge past the neighbour instead.
    const rowSort = other.sort === row.sort ? row.sort + dir : other.sort
    void run(async () => {
      await updateRow(row.id, { sort: rowSort })
      if (other.sort !== row.sort) await updateRow(other.id, { sort: row.sort })
    })
  }

  const nextSort = (rows.at(-1)?.sort ?? 0) + 10

  return (
    <main className="screen">
      <h1>Settings</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <NameField name={name} onSaved={onNameChanged} />
      <HeightField heightIn={heightIn} onSaved={onHeightChanged} />
      <Appearance />
      <InstallCard heading="Install on this phone" />

      <section className="section">
        <h2>What you track</h2>
        <p className="legend">
          Hide rows you don't track, rename them, or move them. Hidden rows keep anything already recorded.
        </p>
        {SECTIONS.map((s) => {
          const list = rows.filter((r) => sectionOf(r) === s.id)
          if (list.length === 0) return null
          return (
            <div key={s.id} className="settings-group">
              <h3>{s.title}</h3>
              <ul className="rows">
                {list.map((r) => (
                  <li key={r.id}>
                    <RowEditor
                      row={r}
                      isFirst={list[0].id === r.id}
                      isLast={list.at(-1)?.id === r.id}
                      onRename={(label) => run(() => updateRow(r.id, { label }))}
                      onToggle={() => run(() => updateRow(r.id, { hidden: !r.hidden }))}
                      onMove={(dir) => move(list, r, dir)}
                      onDelete={() => run(() => deleteRow(r.id))}
                      onDetails={
                        r.scale === 'tick' ? (patch) => run(() => updateRow(r.id, patch)) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        <AddRow
          title="Add a symptom or feeling"
          scales={['0-4', 'MLUYZ', 'count', 'number']}
          groups={SYMPTOM_GROUPS}
          onAdd={(label, scale, category) => run(() => addRow(label, scale, nextSort, category))}
        />
        <AddRow
          title="Add a medication or supplement"
          scales={['tick']}
          onAdd={(label, scale) => run(() => addRow(label, scale, nextSort, 'meds'))}
        />
      </section>

      <section className="section">
        <h2>Your data</h2>
        <p className="legend">Download everything you've recorded as a spreadsheet file.</p>
        <ExportButton rows={rows} />
      </section>

      <Feedback />

      <section className="section">
        <h2>About</h2>
        <p>{CREDIT}</p>
        <p>
          <a href="https://cemcor.ubc.ca/resources/daily-perimenopause-diary/" target="_blank" rel="noreferrer">
            CeMCOR's instructions for the diary
          </a>
        </p>
        <p className="muted small">
          Signed in as {email}. Your entries are stored in Canada and only your account can read them.
        </p>
        <SignOut />
      </section>
    </main>
  )
}

// Signing out clears this phone's copy, including saves not yet sent, so send
// them first and ask before throwing any away.
function SignOut() {
  const [unsent, setUnsent] = useState(0)
  async function signOut(anyway: boolean) {
    if (!anyway) {
      // Offline with an expired sign-in, sending can retry for most of a minute; don't wait that long.
      await Promise.race([flush(), new Promise((resolve) => setTimeout(resolve, 5000))])
      const left = pendingCount()
      if (left > 0) {
        setUnsent(left)
        return
      }
    }
    await supabase.auth.signOut()
    clearLocal()
  }
  if (unsent === 0) return <button onClick={() => signOut(false)}>Sign out</button>
  return (
    <div className="stack">
      <p className="error" role="alert">
        {unsent} {unsent === 1 ? 'change hasn’t' : 'changes haven’t'} reached the server yet. Signing out now
        deletes {unsent === 1 ? 'it' : 'them'} from this phone. Connect to the internet first to keep{' '}
        {unsent === 1 ? 'it' : 'them'}.
      </p>
      <button className="danger" onClick={() => signOut(true)}>
        Sign out and delete {unsent === 1 ? 'it' : 'them'}
      </button>
      <button onClick={() => signOut(false)}>Try again</button>
    </div>
  )
}

function NameField({ name, onSaved }: { name: string; onSaved: (n: string) => void }) {
  const [text, setText] = useState(name)
  const [status, setStatus] = useState('')
  useEffect(() => setText(name), [name])
  return (
    <section className="section">
      <h2>
        <label htmlFor="name">Your name</label>
      </h2>
      <p className="legend">Shown at the top of the copy for your doctor.</p>
      <input
        id="name"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={async () => {
          if (text === name) return
          try {
            await saveName(text.trim())
            onSaved(text.trim())
            setStatus('Saved')
          } catch {
            setStatus("Couldn't save your name. Try again when you're online.")
          }
        }}
      />
      {status && <p className="muted small">{status}</p>}
    </section>
  )
}

// Light unless she chooses otherwise; saved on this phone only.
function Appearance() {
  const [pref, setPref] = useState<ThemePref>(themePref)
  const options: { id: ThemePref; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'Match my phone' },
  ]
  return (
    <section className="section">
      <h2>Appearance</h2>
      <p className="legend">Dark can be easier on the eyes at night.</p>
      <div className="seg" role="group" aria-label="Appearance">
        {options.map((o) => (
          <button
            key={o.id}
            aria-pressed={pref === o.id}
            onClick={() => {
              setThemePref(o.id)
              setPref(o.id)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </section>
  )
}

// Height in feet and inches, stored as inches. Used only to work out BMI.
function HeightField({ heightIn, onSaved }: { heightIn: number | null; onSaved: (h: number | null) => void }) {
  const split = (h: number | null) =>
    h ? [String(Math.floor(h / 12)), String(Math.round((h % 12) * 10) / 10)] : ['', '']
  const [feet, setFeet] = useState(split(heightIn)[0])
  const [inches, setInches] = useState(split(heightIn)[1])
  const [status, setStatus] = useState('')
  useEffect(() => {
    const [f, i] = split(heightIn)
    setFeet(f)
    setInches(i)
  }, [heightIn])
  async function save() {
    const blank = feet.trim() === '' && inches.trim() === ''
    const total = blank ? null : Number(feet || 0) * 12 + Number((inches || '0').replace(',', '.'))
    if (total === heightIn) return
    if (total !== null && !(total >= 36 && total <= 96)) {
      setStatus('That height looks off. Enter feet and inches, like 5 ft 6 in.')
      return
    }
    try {
      await saveHeight(total)
      onSaved(total)
      setStatus('Saved')
    } catch {
      setStatus("Couldn't save your height. Try again when you're online.")
    }
  }
  return (
    <section className="section">
      <h2>Your height</h2>
      <p className="legend">Used to work out your BMI from your weight.</p>
      <div className="height">
        <label>
          <input
            className="num"
            inputMode="numeric"
            aria-label="Height, feet"
            value={feet}
            onChange={(e) => setFeet(e.target.value.replace(/\D/g, ''))}
            onBlur={save}
          />{' '}
          ft
        </label>
        <label>
          <input
            className="num"
            inputMode="decimal"
            aria-label="Height, inches"
            value={inches}
            onChange={(e) => setInches(e.target.value)}
            onBlur={save}
          />{' '}
          in
        </label>
      </div>
      {status && <p className="muted small">{status}</p>}
    </section>
  )
}

function RowEditor({
  row,
  isFirst,
  isLast,
  onRename,
  onToggle,
  onMove,
  onDelete,
  onDetails,
}: {
  row: DiaryRow
  isFirst: boolean
  isLast: boolean
  onRename: (label: string) => void
  onToggle: () => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  // Medications only: saves the usual dose and notes.
  onDetails?: (patch: { dose?: string; notes?: string }) => void
}) {
  const [label, setLabel] = useState(row.label)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => setLabel(row.label), [row.label])
  const id = `row-${row.id}`
  return (
    <div className={`row-edit ${row.hidden ? 'is-hidden' : ''}`}>
      <input
        id={id}
        aria-label="Row name"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label.trim() && label !== row.label && onRename(label.trim())}
      />
      <div className="row-edit-actions">
        <button onClick={onToggle} aria-pressed={!row.hidden}>
          {onDetails ? (row.hidden ? 'Retired' : 'In use') : row.hidden ? 'Hidden' : 'Shown'}
        </button>
        <button onClick={() => onMove(-1)} disabled={isFirst} aria-label={`Move ${row.label} up`}>
          ↑
        </button>
        <button onClick={() => onMove(1)} disabled={isLast} aria-label={`Move ${row.label} down`}>
          ↓
        </button>
        {(row.key === null || row.key.startsWith('custom_')) &&
          (confirming ? (
            <>
              <button className="danger" onClick={onDelete}>
                Delete with its entries
              </button>
              <button onClick={() => setConfirming(false)}>Keep</button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} aria-label={`Delete ${row.label}`}>
              Delete
            </button>
          ))}
      </div>
      {onDetails && <MedDetailsEditor row={row} onSave={onDetails} />}
    </div>
  )
}

function MedDetailsEditor({
  row,
  onSave,
}: {
  row: DiaryRow
  onSave: (patch: { dose?: string; notes?: string }) => void
}) {
  const [dose, setDose] = useState(row.dose)
  const [notes, setNotes] = useState(row.notes)
  useEffect(() => setDose(row.dose), [row.dose])
  useEffect(() => setNotes(row.notes), [row.notes])
  return (
    <div className="med-details">
      <label>
        <span>Usual dose</span>
        <input
          aria-label={`Usual dose of ${row.label}`}
          value={dose}
          placeholder="e.g. 1 pump"
          onChange={(e) => setDose(e.target.value)}
          onBlur={() => dose.trim() !== row.dose && onSave({ dose: dose.trim() })}
        />
      </label>
      <label>
        <span>Notes</span>
        <input
          aria-label={`Notes for ${row.label}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes.trim() !== row.notes && onSave({ notes: notes.trim() })}
        />
      </label>
    </div>
  )
}

function AddRow({
  title,
  scales,
  groups,
  onAdd,
}: {
  title: string
  scales: Scale[]
  groups?: Category[]
  onAdd: (label: string, scale: Scale, category: Category) => void
}) {
  const [label, setLabel] = useState('')
  const [scale, setScale] = useState<Scale>(scales[0])
  const [group, setGroup] = useState<Category>(groups?.[0] ?? 'other')
  // Only strength and count rows go in a symptom group; the others have their own section.
  const choosesGroup = !!groups && (scale === '0-4' || scale === 'count')
  const id = `add-${scales.join('')}`
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    onAdd(label.trim(), scale, choosesGroup ? group : sectionOf({ scale, category: null }))
    setLabel('')
  }
  return (
    <form className="add-row" onSubmit={submit}>
      <label htmlFor={id}>{title}</label>
      <div className="add-row-fields">
        <input id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" />
        {scales.length > 1 && (
          <select aria-label="Scale" value={scale} onChange={(e) => setScale(e.target.value as Scale)}>
            {scales.map((s) => (
              <option key={s} value={s}>
                {SCALE_NAMES[s]}
              </option>
            ))}
          </select>
        )}
        {choosesGroup && (
          <select aria-label="Group" value={group} onChange={(e) => setGroup(e.target.value as Category)}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {sectionTitle(g)}
              </option>
            ))}
          </select>
        )}
        <button className="primary">Add</button>
      </div>
    </form>
  )
}

// A medication shows as "taken", with its time and that day's dose if recorded;
// blood pressure keeps its time.
function cell(row: DiaryRow, value: string | undefined, extra: Extra | undefined) {
  if (value === undefined) return ''
  const detail = [extra?.time, extra?.dose].filter(Boolean).join(', ')
  const shown = row.scale === 'tick' ? 'taken' : value
  return detail ? `${shown} (${detail})` : shown
}

function ExportButton({ rows }: { rows: DiaryRow[] }) {
  const [status, setStatus] = useState('')
  async function exportCsv() {
    setStatus('Preparing…')
    try {
      const { values, extras, comments, fromPhone } = await loadEntries('2000-01-01', today())
      const dates = [...new Set([...Object.keys(values), ...Object.keys(comments)])].sort()
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
      const lines = [
        ['Date', ...rows.map((r) => r.label), 'Comments'].map(esc).join(','),
        ...dates.map((d) =>
          [d, ...rows.map((r) => cell(r, values[d]?.[r.id], extras[d]?.[r.id])), comments[d] ?? '']
            .map(esc)
            .join(','),
        ),
      ]
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `perimenopause-diary-${today()}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      setStatus(
        fromPhone
          ? `Downloaded ${dates.length} days. You're offline, so this file may be missing some days. Try again with internet for the full diary.`
          : `Downloaded ${dates.length} days.`,
      )
    } catch {
      setStatus("Couldn't prepare the file. Try again when you're online.")
    }
  }
  return (
    <>
      <button onClick={exportCsv}>Download my diary (CSV)</button>
      {status && <p className="muted small">{status}</p>}
    </>
  )
}

function Feedback() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await sendFeedback(text.trim())
      setText('')
      setStatus('Sent. Thank you.')
    } catch {
      setStatus("Couldn't send it. Try again when you're online.")
    }
  }
  return (
    <section className="section">
      <h2>
        <label htmlFor="feedback">Send feedback</label>
      </h2>
      <p className="legend">What's confusing, missing, or annoying? Goes straight to Jeremy.</p>
      <form onSubmit={submit} className="stack">
        <textarea id="feedback" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="primary">Send</button>
      </form>
      {status && <p className="muted small">{status}</p>}
    </section>
  )
}
