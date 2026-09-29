// Data access. Entry and comment saves go through an outbox kept in localStorage,
// so a save made without a connection is kept on the phone and sent later.

import { supabase } from './supabase'
import { STANDARD_ROWS, type DiaryRow } from './diary'

export type DayValues = Record<string, string> // row id -> value
export interface Entries {
  values: Record<string, DayValues> // date -> row values
  comments: Record<string, string> // date -> comment
}

type Op =
  | { kind: 'entry'; date: string; rowId: string; value: string | null }
  | { kind: 'comment'; date: string; text: string }

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

export async function ensureSetup(): Promise<void> {
  const { count, error } = await supabase.from('diary_rows').select('id', { count: 'exact', head: true })
  if (error) throw error
  if (count && count > 0) return
  const rows = STANDARD_ROWS.map((r, i) => ({
    key: r.key,
    label: r.label,
    scale: r.scale,
    sort: (i + 1) * 10,
    hidden: r.hidden ?? false,
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
    .select('id, key, label, scale, sort, hidden')
    .order('sort')
  if (error) {
    const cached = read<DiaryRow[] | null>(CACHE_ROWS, null)
    if (cached) return cached
    throw error
  }
  write(CACHE_ROWS, data)
  return data as DiaryRow[]
}

export async function addRow(label: string, scale: DiaryRow['scale'], sort: number) {
  const { error } = await supabase.from('diary_rows').insert({ label, scale, sort })
  if (error) throw error
}

export async function updateRow(id: string, patch: Partial<Pick<DiaryRow, 'label' | 'hidden' | 'sort' | 'scale'>>) {
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
  const comments = { ...entries.comments }
  for (const op of ops) {
    if (op.kind === 'entry') {
      const day = { ...(values[op.date] ?? {}) }
      if (op.value === null) delete day[op.rowId]
      else day[op.rowId] = op.value
      values[op.date] = day
    } else if (op.text.trim()) {
      comments[op.date] = op.text
    } else {
      delete comments[op.date]
    }
  }
  return { values, comments }
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to
}

export async function loadEntries(from: string, to: string): Promise<Entries> {
  const cache = read<Entries>(CACHE_ENTRIES, { values: {}, comments: {} })
  const [e, c] = await Promise.all([
    supabase.from('entries').select('date, row_id, value').gte('date', from).lte('date', to),
    supabase.from('day_comments').select('date, text').gte('date', from).lte('date', to),
  ])
  let fresh: Entries
  if (e.error || c.error) {
    // Offline: fall back to what this phone last saw.
    fresh = { values: {}, comments: {} }
    for (const [d, v] of Object.entries(cache.values)) if (inRange(d, from, to)) fresh.values[d] = v
    for (const [d, t] of Object.entries(cache.comments)) if (inRange(d, from, to)) fresh.comments[d] = t
  } else {
    fresh = { values: {}, comments: {} }
    for (const row of e.data) (fresh.values[row.date] ??= {})[row.row_id] = row.value
    for (const row of c.data) fresh.comments[row.date] = row.text
    // Refresh the cache for this range.
    for (const d of Object.keys(cache.values)) if (inRange(d, from, to)) delete cache.values[d]
    for (const d of Object.keys(cache.comments)) if (inRange(d, from, to)) delete cache.comments[d]
    Object.assign(cache.values, fresh.values)
    Object.assign(cache.comments, fresh.comments)
    write(CACHE_ENTRIES, cache)
  }
  // Unsent saves on this phone win over what the server has.
  const pending = read<Op[]>(OUTBOX, []).filter((op) => inRange(op.date, from, to))
  return applyOps(fresh, pending)
}

export function queue(op: Op) {
  const ops = read<Op[]>(OUTBOX, []).filter((o) => opKey(o) !== opKey(op))
  ops.push(op)
  write(OUTBOX, ops)
  const cache = read<Entries>(CACHE_ENTRIES, { values: {}, comments: {} })
  write(CACHE_ENTRIES, applyOps(cache, [op]))
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
          upserts.map((o) => ({ date: o.date, row_id: o.rowId, value: o.value, entered_at: now })),
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

export async function loadName(): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name').maybeSingle()
  return data?.display_name ?? ''
}

export async function saveName(name: string) {
  const { error } = await supabase.from('profiles').upsert({ display_name: name }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function sendFeedback(message: string) {
  const { error } = await supabase.from('feedback').insert({ message, device: navigator.userAgent })
  if (error) throw error
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
