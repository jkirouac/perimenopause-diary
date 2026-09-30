import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureSetup, flush, loadProfile, loadRows, pendingCount } from './lib/store'
import type { DiaryRow } from './lib/diary'
import { SignIn } from './screens/SignIn'
import { Tonight } from './screens/Tonight'
import { Month } from './screens/Month'
import { Trends } from './screens/Trends'
import { CareTeam } from './screens/CareTeam'
import { Settings } from './screens/Settings'

const TABS = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'month', label: 'Month' },
  { id: 'trends', label: 'Trends' },
  { id: 'care', label: 'Care team' },
  { id: 'settings', label: 'Settings' },
] as const
type Tab = (typeof TABS)[number]['id']

function tabFromHash(): Tab {
  // #doctor was this tab's old name; saved links still open it.
  const h = location.hash.slice(1) === 'doctor' ? 'care' : location.hash.slice(1)
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'tonight'
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <p className="muted center">Loading…</p>
  if (!session) return <SignIn />
  return <Diary email={session.user.email ?? ''} />
}

function Diary({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [rows, setRows] = useState<DiaryRow[] | null>(null)
  const [name, setName] = useState('')
  const [heightIn, setHeightIn] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(pendingCount())

  const reloadRows = useCallback(() => {
    loadRows()
      .then(setRows)
      .catch(() => setError("Couldn't load your diary. Check your connection, then reopen the app."))
  }, [])

  useEffect(() => {
    ensureSetup()
      .catch(() => undefined) // Offline on a later visit: cached rows still load.
      .finally(reloadRows)
    loadProfile()
      .then((p) => {
        setName(p.name)
        setHeightIn(p.heightIn)
      })
      .catch(() => undefined)
  }, [reloadRows])

  // Send saves made offline once the connection is back, and keep the count current.
  // A save can also fail with the phone online (a dropped request), so retry when
  // the app comes back to the front and every minute while anything is waiting.
  useEffect(() => {
    const sync = () => flush().finally(() => setPending(pendingCount()))
    const onVisible = () => document.visibilityState === 'visible' && sync()
    sync()
    window.addEventListener('online', sync)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => setPending(pendingCount()), 3000)
    const retry = setInterval(() => pendingCount() > 0 && sync(), 60_000)
    return () => {
      window.removeEventListener('online', sync)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
      clearInterval(retry)
    }
  }, [])

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function go(t: Tab) {
    history.replaceState(null, '', `#${t}`)
    setTab(t)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
      {pending > 0 && (
        <p className="offline no-print" role="status">
          {pending} {pending === 1 ? 'change is' : 'changes are'} saved on this phone and will send on their own
          once there's a connection.
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {rows &&
        (tab === 'tonight' ? (
          <Tonight rows={rows} heightIn={heightIn} />
        ) : tab === 'month' ? (
          <Month rows={rows} />
        ) : tab === 'trends' ? (
          <Trends rows={rows} heightIn={heightIn} />
        ) : tab === 'care' ? (
          <CareTeam rows={rows} name={name} />
        ) : (
          <Settings
            rows={rows}
            name={name}
            heightIn={heightIn}
            email={email}
            onRowsChanged={reloadRows}
            onNameChanged={setName}
            onHeightChanged={setHeightIn}
          />
        ))}
      {!rows && !error && <p className="muted center">Loading…</p>}
      <nav className="tabs no-print" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <TabIcon id={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function TabIcon({ id }: { id: Tab }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (id) {
    case 'tonight':
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
        </svg>
      )
    case 'month':
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
        </svg>
      )
    case 'trends':
      return (
        <svg {...common}>
          <path d="M3 17l5-5 4 3 8-8M15 7h5v5" />
        </svg>
      )
    case 'care':
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v4h4M10 12h5M10 16h5" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      )
  }
}
