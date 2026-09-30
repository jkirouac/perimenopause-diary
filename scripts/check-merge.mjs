// Safety checks around supabase/migrations/20260930000000_tracker_spec.sql.
// Prints counts and pass/fail lines only, never diary values.
//
//   node --env-file=.env.local scripts/check-merge.mjs prepare-test <email>   old-layout test account with tricky breast values
//   node --env-file=.env.local scripts/check-merge.mjs backup <email>         save the account to backups/ (git-ignored)
//   (push the migration)
//   node --env-file=.env.local scripts/check-merge.mjs compare <email>        live account against its latest backup
//   node --env-file=.env.local scripts/check-merge.mjs verify-test <email>    exact expected result for the test account
//   node --env-file=.env.local scripts/check-merge.mjs delete-test <email>

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const [mode, email] = process.argv.slice(2)
if (!mode || !email) throw new Error('Usage: check-merge.mjs <mode> <email>')
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let failures = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

async function userId() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No account for ${email}`)
  return user.id
}

// Everything in one account, paged past the 1,000-row limit.
async function snapshot(uid) {
  const all = async (table, columns, order) => {
    const out = []
    for (let first = 0; ; first += 1000) {
      let q = admin.from(table).select(columns).eq('user_id', uid)
      for (const o of order) q = q.order(o)
      const { data, error } = await q.range(first, first + 999)
      if (error) throw error
      out.push(...data)
      if (data.length < 1000) return out
    }
  }
  return {
    takenAt: new Date().toISOString(),
    rows: await all('diary_rows', '*', ['id']),
    entries: await all('entries', '*', ['date', 'row_id']),
    comments: await all('day_comments', '*', ['date']),
    profile: (await admin.from('profiles').select('*').eq('user_id', uid).maybeSingle()).data,
  }
}

const backupFile = () => {
  const safe = email.replace(/[^a-z0-9]/gi, '_')
  const files = fs.existsSync('backups') ? fs.readdirSync('backups').filter((f) => f.startsWith(safe)).sort() : []
  return { dir: 'backups', safe, latest: files.at(-1) && `backups/${files.at(-1)}` }
}

if (mode === 'backup') {
  const snap = await snapshot(await userId())
  const { dir, safe } = backupFile()
  fs.mkdirSync(dir, { recursive: true })
  const file = `${dir}/${safe}-${snap.takenAt.replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(file, JSON.stringify(snap, null, 1))
  const back = JSON.parse(fs.readFileSync(file, 'utf8'))
  check(`Backup written to ${file}`, back.entries.length === snap.entries.length)
  console.log(`  ${snap.rows.length} rows, ${snap.entries.length} entries, ${snap.comments.length} comments`)
}

if (mode === 'compare') {
  const { latest } = backupFile()
  if (!latest) throw new Error('No backup for this account')
  const before = JSON.parse(fs.readFileSync(latest, 'utf8'))
  const after = await snapshot(await userId())
  const keyOf = Object.fromEntries(before.rows.map((r) => [r.id, r.key]))
  const liveRow = Object.fromEntries(after.rows.map((r) => [r.id, r]))
  const byKey = (snap, key) => snap.rows.find((r) => r.key === key)

  // What each entry should be after the merge.
  const expected = new Map()
  const at = (date, rowId) => `${date}|${rowId}`
  const front = byKey(before, 'breast_front')
  const side = byKey(before, 'breast_side')
  const breastId = front?.id ?? side?.id
  for (const e of before.entries) {
    if (keyOf[e.row_id] === 'breast_side' && front) {
      const k = at(e.date, breastId)
      const had = expected.get(k)
      expected.set(k, had === undefined || e.value > had ? e.value : had)
    } else {
      const k = at(e.date, e.row_id)
      const had = expected.get(k)
      // A front value can arrive after its side value was already placed.
      expected.set(k, had === undefined || e.value > had ? e.value : had)
    }
  }
  const newSince = after.entries.filter((e) => e.entered_at > before.takenAt)
  const live = new Map(after.entries.filter((e) => e.entered_at <= before.takenAt).map((e) => [at(e.date, e.row_id), e.value]))
  let same = 0
  let differ = 0
  let missing = 0
  for (const [k, v] of expected) {
    if (!live.has(k)) missing++
    else if (live.get(k) === v) same++
    else differ++
  }
  const unexpected = [...live.keys()].filter((k) => !expected.has(k)).length
  check(`Every value is where it should be (${same} match)`, differ === 0 && missing === 0)
  check('No value changed', differ === 0)
  check('No value lost', missing === 0)
  check('No stray values appeared', unexpected === 0)
  console.log(`  ${newSince.length} entries were made after the backup and are left out of this comparison.`)
  check(
    'Comments unchanged',
    JSON.stringify(before.comments.map((c) => [c.date, c.text])) ===
      JSON.stringify(after.comments.filter((c) => c.entered_at <= before.takenAt).map((c) => [c.date, c.text])),
  )
  check('Name unchanged', (before.profile?.display_name ?? '') === (after.profile?.display_name ?? ''))
  check('Breast front and side are now one row', !byKey(after, 'breast_side') && !!byKey(after, 'breast'))
  for (const [oldKey, newKey] of [
    ['custom_lbp', 'pain_sleep'],
    ['custom_memory', 'brain_fog'],
  ]) {
    const was = byKey(before, oldKey)
    if (was) check(`${oldKey} became ${newKey}, same row`, liveRow[was.id]?.key === newKey)
  }
  for (const key of ['fluid', 'breast_size', 'bbt', 'cup', 'acne']) {
    const was = byKey(before, key)
    if (!was) continue
    const used = before.entries.some((e) => e.row_id === was.id)
    const now = liveRow[was.id]
    check(
      `${key}: ${used ? 'kept hidden, it has entries' : 'removed, it had no entries'}`,
      used ? now?.hidden === true : now === undefined,
    )
  }
  const kept = before.rows.filter((r) => !['breast_side', 'fluid', 'breast_size', 'bbt', 'cup', 'acne'].includes(r.key))
  check('Every other row is still there', kept.every((r) => liveRow[r.id]))
  check('Every row has a group', after.rows.every((r) => r.category))
}

if (mode === 'prepare-test') {
  execFileSync(process.execPath, ['--env-file=.env.local', 'scripts/seed-first-user.mjs', email], { stdio: 'inherit' })
  const uid = await userId()
  const { data: rows } = await admin.from('diary_rows').select('id, key').eq('user_id', uid)
  const id = Object.fromEntries(rows.map((r) => [r.key, r.id]))
  // Front and side disagree on purpose; one day has side only; fluid gets a value.
  const set = (key, date, value) => ({ user_id: uid, row_id: id[key], date, value })
  const { error } = await admin.from('entries').upsert(
    [
      set('breast_side', '2026-09-02', '3'),
      set('breast_front', '2026-09-03', '2'),
      set('breast_side', '2026-09-03', '1'),
      set('breast_side', '2026-09-07', '2'),
      set('fluid', '2026-09-01', '1'),
    ],
    { onConflict: 'user_id,date,row_id' },
  )
  if (error) throw error
  console.log('Test account ready in the old layout.')
}

if (mode === 'verify-test') {
  const uid = await userId()
  const { data: rows } = await admin.from('diary_rows').select('*').eq('user_id', uid)
  const row = (key) => rows.find((r) => r.key === key)
  const { data: entries } = await admin.from('entries').select('date, row_id, value').eq('user_id', uid)
  const series = (key) => {
    const r = row(key)
    return ['01', '02', '03', '04', '05', '06', '07', '08'].map(
      (d) => entries.find((e) => e.row_id === r?.id && e.date === `2026-09-${d}`)?.value ?? '-',
    )
  }
  // Expected values come from the private September file (never from this public repo),
  // with prepare-test's deliberate breast changes applied on top.
  const september = JSON.parse(fs.readFileSync(new URL('./private/first-user-september.json', import.meta.url), 'utf8'))
  const asText = (values) => values.map((v) => (v === null ? '-' : String(v))).join('')
  const front = [...september.breast_front]
  const side = [...september.breast_side]
  side[1] = 3
  front[2] = 2
  side[2] = 1
  side[6] = 2
  const breast = front.map((f, i) => (f === null && side[i] === null ? null : Math.max(f ?? -1, side[i] ?? -1)))
  check('Breast soreness keeps the higher value', series('breast').join('') === asText(breast))
  check('Pain affecting sleep carries the back pain values', series('pain_sleep').join('') === asText(september.custom_lbp))
  check('Brain fog carries the memory values', series('brain_fog').join('') === asText(september.custom_memory))
  check('Irritability relabelled', row('frustrated')?.label === 'Irritability / anger / rage')
  check('Night sweats in the night flush label', row('flush_night')?.label === 'Hot flushes / night sweats – night')
  check('Fluid retention kept hidden because it has a value', row('fluid')?.hidden === true)
  check('Unused dropped rows removed', !row('breast_size') && !row('bbt') && !row('cup'))
  check('Her own symptom row sits in Physical', row('custom_itchy')?.category === 'physical')
  const meds = rows.filter((r) => r.scale === 'tick')
  check('Medications grouped', meds.length > 0 && meds.every((r) => r.category === 'meds'))
}

if (mode === 'delete-test') {
  if (!email.endsWith('@example.com')) throw new Error('Only deletes @example.com test accounts')
  await admin.auth.admin.deleteUser(await userId())
  console.log(`Deleted ${email}`)
}

if (failures) {
  console.log(`${failures} check(s) failed.`)
  process.exit(1)
}
