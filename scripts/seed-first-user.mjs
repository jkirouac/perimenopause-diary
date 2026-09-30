// Sets up the first user's diary to match her paper form, and loads
// September 2026 days 1–8 as transcribed from it.
// Run: node --env-file=.env.local scripts/seed-first-user.mjs her@email
//
// Historical: this builds the row layout from before 2026-09-30. The migration
// 20260930000000_tracker_spec.sql turns it into the current one. It refuses to
// run on an account that already has entries, so it can never overwrite a diary.
//
// Transcription rules: "/" cells stay blank (not recorded); uncertain
// readings stay blank; rows she crossed out are hidden and not loaded.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email) throw new Error('Pass her email address')
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Find or create her account. Creating it sends no email.
const { data: list } = await admin.auth.admin.listUsers()
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
if (!user) {
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) throw error
  user = data.user
  console.log(`Created account for ${email}`)
} else {
  console.log(`Account already exists for ${email}`)
}
const uid = user.id

const { count: existing } = await admin.from('entries').select('*', { count: 'exact', head: true }).eq('user_id', uid)
if (existing) {
  console.log(`${email} already has ${existing} entries. Not loading anything.`)
  process.exit(1)
}

// The paper form's rows as the app first had them (before 2026-09-30).
const PAPER_ROWS = [
  ['flow', 'Amount of flow', '0-4'],
  ['cramps', 'Cramps', '0-4'],
  ['breast_front', 'Breast sore – front', '0-4'],
  ['breast_side', 'Breast sore – side', '0-4'],
  ['fluid', 'Fluid retention', '0-4'],
  ['flush_day', 'Hot flushes – day', '0-4'],
  ['flush_day_n', '# of flushes – day', 'count'],
  ['flush_night', 'Hot flushes – night', '0-4'],
  ['flush_night_n', '# of flushes – night', 'count'],
  ['mucus', 'Mucus secretions', '0-4'],
  ['constipation', 'Constipation', '0-4'],
  ['headache', 'Headache', '0-4'],
  ['sleep', 'Sleep problems', '0-4'],
  ['frustrated', 'Feeling frustrated', '0-4'],
  ['depressed', 'Feeling depressed', '0-4'],
  ['anxious', 'Feeling anxious', '0-4'],
  ['appetite', 'Appetite', 'MLUYZ'],
  ['breast_size', 'Breast size', 'MLUYZ'],
  ['sex', 'Interest in sex', 'MLUYZ'],
  ['energy', 'Feeling of energy', 'MLUYZ'],
  ['self_worth', 'Feeling of self-worth', 'MLUYZ'],
  ['stress', 'Outside stresses', 'MLUYZ'],
  ['bbt', 'Basal temperature', 'number'],
  ['cup', 'Menstrual cup flow (mL)', 'number'],
].map(([key, label, scale]) => ({ key, label, scale }))

// Her own row and medication names, like her answers, stay off this public repo.
const ROWS_FILE = new URL('./private/first-user-rows.json', import.meta.url)
if (!fs.existsSync(ROWS_FILE)) throw new Error('Missing scripts/private/first-user-rows.json (kept off GitHub on purpose).')
const PRIVATE_ROWS = JSON.parse(fs.readFileSync(ROWS_FILE, 'utf8'))

const HIDDEN = new Set(['fluid', 'breast_size', 'bbt', 'cup'])
const RENAME = { frustrated: 'Feeling irritable' }
const rows = [
  // Her handwritten rows sit at the top of the form (names kept in a private file).
  ...PRIVATE_ROWS.handwritten,
  ...PAPER_ROWS.map((r, i) => ({
    key: r.key,
    label: RENAME[r.key] ?? r.label,
    scale: r.scale,
    sort: (i + 1) * 10,
    hidden: HIDDEN.has(r.key) || !!r.hidden,
  })),
  ...PRIVATE_ROWS.medications,
].map((r) => ({ hidden: false, ...r, user_id: uid }))

const { data: saved, error: rowErr } = await admin
  .from('diary_rows')
  .upsert(rows, { onConflict: 'user_id,key' })
  .select('id, key')
if (rowErr) throw rowErr
const id = Object.fromEntries(saved.map((r) => [r.key, r.id]))

// Her September 1–8 answers live in a git-ignored file, never in this public repo.
// Keys are row keys; each array is days 1–8, with null for blank.
const DATA_FILE = new URL('./private/first-user-september.json', import.meta.url)
if (!fs.existsSync(DATA_FILE)) throw new Error('Missing scripts/private/first-user-september.json (kept off GitHub on purpose).')
const DATA = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))

const entries = []
for (const [key, values] of Object.entries(DATA)) {
  values.forEach((v, i) => {
    if (v === null) return
    entries.push({
      user_id: uid,
      date: `2026-09-0${i + 1}`,
      row_id: id[key],
      value: String(v),
      entered_at: `2026-09-0${i + 1}T21:00:00-07:00`,
    })
  })
}
const { error: entryErr } = await admin.from('entries').upsert(entries, { onConflict: 'user_id,date,row_id' })
if (entryErr) throw entryErr
console.log(`Loaded ${entries.length} values across September 1–8.`)
