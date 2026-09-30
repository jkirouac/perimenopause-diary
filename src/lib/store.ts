// Data access. Entry and comment saves go through an outbox kept in localStorage,
// so a save made without a connection is kept on the phone and sent later.

import { supabase } from './supabase'
import { STANDARD_ROWS, type DiaryRow } from './diary'

export type DayValues = Record<string, string> // row id -> value
// Optional details on a value: when a medication was taken and a dose that
// differs from its usual one, or when a blood pressure was measured.
export interface Extra {
  time?: string
  dose?: string
}
export interface Entries {
  values: Record<string, DayValues> // date -> row values
  extras: Record<string, Record<string, Extra>> // date -> row id -> details
  comments: Record<string, string> // date -> comment
  // True when the server couldn't be reached and this is only what the phone had saved.
  fromPhone?: boolean
}

type Op =
  | { kind: 'entry'; date: string; rowId: string; value: string | null; extra?: Extra | null }
  | { kind: 'comment'; date: string; text: string }

const EMPTY: Entries = { values: {}, extras: {}, comments: {} }

// Drops empty fields, and returns null when nothing is left.
export function cleanExtra(extra: Extra | null | undefined): Extra | null {
  const out: Extra = {}
  if (extra?.time) out.time = extra.time
  if (extra?.dose?.trim()) out.dose = extra.dose.trim()
  return Object.keys(out).length ? out : null
}

const OUTBOX = 'pd-outbox'
const CACHE_ROWS = 'pd-rows'
const CACHE_ENTRIES = 'pd-entries'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: the save still goes to the server when online.
  }
}

function opKey(op: Op) {
  return op.kind === 'entry' ? `e:${op.date}:${op.rowId}` : `c:${op.date}`
}

export function pendingCount(): number {
  return read<Op[]>(OUTBOX, []).length
}

// ---------- setup ----------

// Adds any standard row this account doesn't have yet: all of them on first
// sign-in, and rows added to the list since for existing accounts. Rows already
// there are left alone, so renames and hiding stick.
export async function ensureSetup(): Promise<void> {
  const rows = STANDARD_ROWS.map((r) => ({
    key: r.key,
    label: r.label,
    scale: r.scale,
    category: r.category,
    sort: r.sort,
  }))
  const { error: insertError } = await supabase
    .from('diary_rows')
    .upsert(rows, { onConflict: 'user_id,key', ignoreDuplicates: true })
  if (insertError) throw insertError
  await supabase.from('profiles').upsert({ display_name: '' }, { onConflict: 'user_id', ignoreDuplicates: true })
}

// ---------- rows ----------

export async function loadRows(): Promise<DiaryRow[]> {
  const { data, error } = await supabase
    .from('diary_rows')
    .select('id, key, label, scale, sort, hidden, category, dose, notes')
    .order('sort')
  if (error) {
    const cached = read<DiaryRow[] | null>(CACHE_ROWS, null)
    if (cached) return cached
    throw error
  }
  write(CACHE_ROWS, data)
  return data as DiaryRow[]
}

export async function addRow(label: string, scale: DiaryRow['scale'], sort: number, category: string) {
  const { error } = await supabase.from('diary_rows').insert({ label, scale, sort, category })
  if (error) throw error
}

export async function updateRow(
  id: string,
  patch: Partial<Pick<DiaryRow, 'label' | 'hidden' | 'sort' | 'scale' | 'dose' | 'notes'>>,
) {
  const { error } = await supabase.from('diary_rows').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteRow(id: string) {
  const { error } = await supabase.from('diary_rows').delete().eq('id', id)
  if (error) throw error
}

// ---------- entries ----------

function applyOps(entries: Entries, ops: Op[]): Entries {
  const values = { ...entries.values }
  const extras = { ...(entries.extras ?? {}) }
  const comments = { ...entries.comments }
  for (const op of ops) {
    if (op.kind === 'entry') {
      const day = { ...(values[op.date] ?? {}) }
      const dayExtras = { ...(extras[op.date] ?? {}) }
      const extra = op.value === null ? null : cleanExtra(op.extra)
      if (op.value === null) delete day[op.rowId]
      else day[op.rowId] = op.value
      if (extra) dayExtras[op.rowId] = extra
      else delete dayExtras[op.rowId]
      values[op.date] = day
      extras[op.date] = dayExtras
    } else if (op.text.trim()) {
      comments[op.date] = op.text
    } else {
      delete comments[op.date]
    }
  }
  return { values, extras, comments }
}

// A cache saved before extras existed has no extras part.
function readCache(): Entries {
  const cache = read<Entries>(CACHE_ENTRIES, EMPTY)
  return { values: cache.values ?? {}, extras: cache.extras ?? {}, comments: cache.comments ?? {} }
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to
}

// The server sends at most this many rows per request (max_rows in supabase/config.toml).
const PAGE = 1000

// Asks for page after page until one comes back short. Each query must have a
// complete order, or rows can repeat or go missing between pages.
async function selectAll<T>(
  page: (first: number, last: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: null } | { data: null; error: unknown }> {
  const all: T[] = []
  for (let first = 0; ; first += PAGE) {
    const { data, error } = await page(first, first + PAGE - 1)
    if (error) return { data: null, error }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) return { data: all, error: null }
  }
}

export async function loadEntries(from: string, to: string): Promise<Entries> {
  const cache = readCache()
  const [e, c] = await Promise.all([
    selectAll<{ date: string; row_id: string; value: string; extra: Extra | null }>((first, last) =>
      supabase
        .from('entries')
        .select('date, row_id, value, extra')
        .gte('date', from)
        .lte('date', to)
        .order('date')
        .order('row_id')
        .range(first, last),
    ),
    selectAll<{ date: string; text: string }>((first, last) =>
      supabase
        .from('day_comments')
        .select('date, text')
        .gte('date', from)
        .lte('date', to)
        .order('date')
        .range(first, last),
    ),
  ])
  let fresh: Entries
  const fromPhone = !e.data || !c.data
  if (!e.data || !c.data) {
    // Offline: fall back to what this phone last saw.
    fresh = { values: {}, extras: {}, comments: {} }
    for (const [d, v] of Object.entries(cache.values)) if (inRange(d, from, to)) fresh.values[d] = v
    for (const [d, x] of Object.entries(cache.extras)) if (inRange(d, from, to)) fresh.extras[d] = x
    for (const [d, t] of Object.entries(cache.comments)) if (inRange(d, from, to)) fresh.comments[d] = t
  } else {
    fresh = { values: {}, extras: {}, comments: {} }
    for (const row of e.data) {
      ;(fresh.values[row.date] ??= {})[row.row_id] = row.value
      if (row.extra) (fresh.extras[row.date] ??= {})[row.row_id] = row.extra
    }
    for (const row of c.data) fresh.comments[row.date] = row.text
    // Refresh the cache for this range.
    for (const part of ['values', 'extras', 'comments'] as const) {
      for (const d of Object.keys(cache[part])) if (inRange(d, from, to)) delete cache[part][d]
      Object.assign(cache[part], fresh[part])
    }
    write(CACHE_ENTRIES, cache)
  }
  // Unsent saves on this phone win over what the server has.
  const pending = read<Op[]>(OUTBOX, []).filter((op) => inRange(op.date, from, to))
  return { ...applyOps(fresh, pending), fromPhone }
}

export function queue(op: Op) {
  const ops = read<Op[]>(OUTBOX, []).filter((o) => opKey(o) !== opKey(op))
  ops.push(op)
  write(OUTBOX, ops)
  write(CACHE_ENTRIES, applyOps(readCache(), [op]))
  void flush()
}

let flushing: Promise<void> | null = null

export function flush(): Promise<void> {
  flushing ??= doFlush().finally(() => {
    flushing = null
  })
  return flushing
}

// Sends queued saves until the outbox is empty, re-reading it each round so saves
// queued meanwhile go out too. Each outbox entry is for a different day and row,
// so they can go in any order. Stops at the first failure and tries again later.
async function doFlush() {
  for (;;) {
    const ops = read<Op[]>(OUTBOX, [])
    if (ops.length === 0) return
    const upserts = ops.filter((o): o is Extract<Op, { kind: 'entry' }> => o.kind === 'entry' && o.value !== null)
    const batch: Op[] = upserts.length ? upserts : [ops[0]]
    const now = new Date().toISOString()
    let error
    if (upserts.length) {
      error = (
        await supabase.from('entries').upsert(
          upserts.map((o) => ({
            date: o.date,
            row_id: o.rowId,
            value: o.value,
            extra: cleanExtra(o.extra),
            entered_at: now,
          })),
          { onConflict: 'user_id,date,row_id' },
        )
      ).error
    } else {
      const op = ops[0]
      if (op.kind === 'entry') {
        error = (await supabase.from('entries').delete().match({ date: op.date, row_id: op.rowId })).error
      } else if (op.text.trim()) {
        error = (
          await supabase
            .from('day_comments')
            .upsert({ date: op.date, text: op.text, entered_at: now }, { onConflict: 'user_id,date' })
        ).error
      } else {
        error = (await supabase.from('day_comments').delete().eq('date', op.date)).error
      }
    }
    if (error?.code === '23503') {
      // A save for a row that has since been deleted: drop it so it can't block the rest.
      const { data: live } = await supabase.from('diary_rows').select('id')
      if (!live) return
      const ids = new Set(live.map((r) => r.id))
      write(
        OUTBOX,
        read<Op[]>(OUTBOX, []).filter((o) => o.kind !== 'entry' || ids.has(o.rowId)),
      )
      continue
    }
    if (error) return
    // Remove what was sent, unless it was changed again while sending.
    const sent = new Set(batch.map((o) => JSON.stringify(o)))
    write(
      OUTBOX,
      read<Op[]>(OUTBOX, []).filter((o) => !sent.has(JSON.stringify(o))),
    )
  }
}

// ---------- profile and feedback ----------

export interface Profile {
  name: string
  heightIn: number | null // height in inches, for BMI
}

export async function loadProfile(): Promise<Profile> {
  const { data } = await supabase.from('profiles').select('display_name, height_in').maybeSingle()
  return { name: data?.display_name ?? '', heightIn: data?.height_in == null ? null : Number(data.height_in) }
}

export async function saveName(name: string) {
  const { error } = await supabase.from('profiles').upsert({ display_name: name }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function saveHeight(heightIn: number | null) {
  const { error } = await supabase.from('profiles').upsert({ height_in: heightIn }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function sendFeedback(message: string) {
  const { error } = await supabase.from('feedback').insert({ message, device: navigator.userAgent })
  if (error) throw error
}

// Deletes this account and everything recorded in it, then clears the phone's copy.
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  clearLocal()
  // The session died with the account, so only this phone needs signing out.
  await supabase.auth.signOut({ scope: 'local' })
}

export function clearLocal() {
  for (const key of [OUTBOX, CACHE_ROWS, CACHE_ENTRIES]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}
