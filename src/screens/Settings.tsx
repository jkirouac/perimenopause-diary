import { useEffect, useState, type FormEvent } from 'react'
import { CREDIT, SCALE_NAMES, SECTIONS, type DiaryRow, type Scale } from '../lib/diary'
import { today } from '../lib/dates'
import { addRow, clearLocal, deleteRow, loadEntries, saveName, sendFeedback, updateRow } from '../lib/store'
import { supabase } from '../lib/supabase'

interface Props {
  rows: DiaryRow[]
  name: string
  email: string
  onRowsChanged: () => void
  onNameChanged: (name: string) => void
}

export function Settings({ rows, name, email, onRowsChanged, onNameChanged }: Props) {
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

  function move(row: DiaryRow, dir: -1 | 1) {
    const i = rows.findIndex((r) => r.id === row.id)
    const other = rows[i + dir]
    if (!other) return
    void run(async () => {
      await updateRow(row.id, { sort: other.sort })
      await updateRow(other.id, { sort: row.sort })
    })
  }

  const nextSort = (rows.at(-1)?.sort ?? 0) + 10

  return (
    <main className="screen">
      <h1>Settings</h1>
      {error && <p className="error" role="alert">{error}</p>}

      <NameField name={name} onSaved={onNameChanged} />

      <section className="section">
        <h2>What you track</h2>
        <p className="legend">
          Hide rows you don't track, rename them, or move them. Hidden rows keep anything already recorded.
        </p>
        {SECTIONS.map((s) => {
          const list = rows.filter((r) => s.scales.includes(r.scale))
          if (list.length === 0) return null
          return (
            <div key={s.title} className="settings-group">
              <h3>{s.title}</h3>
              <ul className="rows">
                {list.map((r) => (
                  <li key={r.id}>
                    <RowEditor
                      row={r}
                      isFirst={rows[0].id === r.id}
                      isLast={rows.at(-1)?.id === r.id}
                      onRename={(label) => run(() => updateRow(r.id, { label }))}
                      onToggle={() => run(() => updateRow(r.id, { hidden: !r.hidden }))}
                      onMove={(dir) => move(r, dir)}
                      onDelete={() => run(() => deleteRow(r.id))}
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
          onAdd={(label, scale) => run(() => addRow(label, scale, nextSort))}
        />
        <AddRow
          title="Add a treatment or supplement"
          scales={['tick']}
          onAdd={(label, scale) => run(() => addRow(label, scale, nextSort))}
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
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            clearLocal()
          }}
        >
          Sign out
        </button>
      </section>
    </main>
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

function RowEditor({
  row,
  isFirst,
  isLast,
  onRename,
  onToggle,
  onMove,
  onDelete,
}: {
  row: DiaryRow
  isFirst: boolean
  isLast: boolean
  onRename: (label: string) => void
  onToggle: () => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
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
          {row.hidden ? 'Hidden' : 'Shown'}
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
    </div>
  )
}

function AddRow({
  title,
  scales,
  onAdd,
}: {
  title: string
  scales: Scale[]
  onAdd: (label: string, scale: Scale) => void
}) {
  const [label, setLabel] = useState('')
  const [scale, setScale] = useState<Scale>(scales[0])
  const id = `add-${scales.join('')}`
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    onAdd(label.trim(), scale)
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
        <button className="primary">Add</button>
      </div>
    </form>
  )
}

function ExportButton({ rows }: { rows: DiaryRow[] }) {
  const [status, setStatus] = useState('')
  async function exportCsv() {
    setStatus('Preparing…')
    try {
      const { values, comments } = await loadEntries('2000-01-01', today())
      const dates = [...new Set([...Object.keys(values), ...Object.keys(comments)])].sort()
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
      const lines = [
        ['Date', ...rows.map((r) => r.label), 'Comments'].map(esc).join(','),
        ...dates.map((d) =>
          [d, ...rows.map((r) => values[d]?.[r.id] ?? ''), comments[d] ?? ''].map(esc).join(','),
        ),
      ]
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `perimenopause-diary-${today()}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      setStatus(`Downloaded ${dates.length} days.`)
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
