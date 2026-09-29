// Checks that one person can't read or change another person's diary.
// Creates two throwaway accounts, tries to cross the line, then deletes them.
// Run: node --env-file=.env.local scripts/check-privacy.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const stamp = Date.now()
const people = [`privacy-a-${stamp}@example.com`, `privacy-b-${stamp}@example.com`]
const password = `Pw-${stamp}-${Math.random().toString(36).slice(2)}`
const ids = []
let failures = 0

function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

async function signedIn(email) {
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

try {
  for (const email of people) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) throw error
    ids.push(data.user.id)
  }
  const [a, b] = [await signedIn(people[0]), await signedIn(people[1])]

  const { data: rowA, error: rowErr } = await a
    .from('diary_rows')
    .insert({ key: 'headache', label: 'Headache', scale: '0-4', sort: 10 })
    .select()
    .single()
  if (rowErr) throw rowErr
  const { error: entryErr } = await a.from('entries').insert({ date: '2026-09-01', row_id: rowA.id, value: '3' })
  if (entryErr) throw entryErr
  await a.from('day_comments').insert({ date: '2026-09-01', text: 'private note' })

  check('A can read her own entry', ((await a.from('entries').select()).data ?? []).length === 1)
  check("B sees none of A's rows", ((await b.from('diary_rows').select()).data ?? []).length === 0)
  check("B sees none of A's entries", ((await b.from('entries').select()).data ?? []).length === 0)
  check("B sees none of A's comments", ((await b.from('day_comments').select()).data ?? []).length === 0)

  await b.from('entries').update({ value: '0' }).eq('row_id', rowA.id)
  const { data: still } = await a.from('entries').select('value').single()
  check("B can't change A's entry", still?.value === '3')

  await b.from('diary_rows').delete().eq('id', rowA.id)
  check("B can't delete A's row", ((await a.from('diary_rows').select()).data ?? []).length === 1)

  const { error: forged } = await b
    .from('entries')
    .insert({ user_id: ids[0], date: '2026-09-02', row_id: rowA.id, value: '4' })
  check("B can't write into A's diary", forged !== null)

  const { error: fb } = await b.from('feedback').insert({ message: 'test feedback' })
  check('B can send feedback', fb === null)
  check("B can't read feedback back", ((await b.from('feedback').select()).data ?? []).length === 0)

  const anonClient = createClient(url, anon, { auth: { persistSession: false } })
  check('Signed-out visitor sees no entries', ((await anonClient.from('entries').select()).data ?? []).length === 0)
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id)
  console.log(`Deleted ${ids.length} test accounts.`)
}

console.log(failures === 0 ? 'All privacy checks passed.' : `${failures} privacy check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
