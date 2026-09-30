// Makes the landing page's screenshots from a throwaway demo account filled with
// invented entries (never a real diary), then deletes the account.
// Run with the dev server up: node --env-file=.env.local scripts/landing-shots.mjs
// Writes public/landing/{tonight,care-team,trends,month}.webp and og.png.

import fs from 'node:fs'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

const APP = process.env.APP_URL ?? 'http://localhost:5173/perimenopause-diary/'
const OUT = 'public/landing'
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const email = `landing-demo-${Date.now()}@example.com`

// Small seeded random numbers, so the invented month looks the same every run.
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (weights) => {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rand() * total
  return weights.findIndex((w) => (r -= w) < 0)
}
const day = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function webp(buffer, name, width) {
  await sharp(buffer).resize({ width }).webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`)
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
let userId
try {
  await admin.auth.admin.createUser({ email, email_confirm: true })
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  userId = link.user.id

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await context.addInitScript(() => localStorage.setItem('pd-install-dismissed', '1'))
  await context.route('**/auth/v1/otp**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await context.newPage()
  await page.goto(`${APP}#signin`)
  await page.fill('#email', email)
  await page.click('text=Email me a sign-in code')
  await page.fill('#code', link.properties.email_otp)
  await page.click('button:has-text("Sign in")')
  await page.waitForSelector('.rows')

  // Invented medications, then a month of invented entries.
  await admin.from('diary_rows').insert([
    { user_id: userId, label: 'Estradiol gel', scale: 'tick', sort: 900, category: 'meds', dose: '2 pumps' },
    { user_id: userId, label: 'Magnesium', scale: 'tick', sort: 910, category: 'meds', dose: '200 mg' },
  ])
  const { data: rows } = await admin.from('diary_rows').select('id, key, label, scale').eq('user_id', userId)
  const entries = []
  const comments = []
  for (let n = 1; n <= 34; n++) {
    const date = day(n)
    const easing = n < 14 ? 1 : 0 // a little easier lately, after starting estradiol
    for (const r of rows) {
      let value = null
      if (r.scale === '0-4') value = String(pick(easing ? [5, 4, 2, 1, 0] : [3, 4, 3, 2, 1]))
      if (r.key === 'flow') value = n > 20 && n < 25 ? String(pick([0, 2, 3, 2, 1])) : '0'
      if (r.scale === 'count') value = String(pick(easing ? [3, 4, 2, 1] : [1, 2, 3, 3, 2]))
      if (r.scale === 'MLUYZ') value = 'MLUYZ'[pick([1, 2, 6, 2, 1])]
      if (r.label === 'Estradiol gel') value = n < 14 ? '1' : null
      if (r.label === 'Magnesium') value = rand() < 0.6 ? '1' : null
      if (r.key === 'weight') value = n % 7 === 0 ? String(152 - Math.floor(n / 14)) : null
      if (r.key === 'bp') value = n % 10 === 0 ? '118/76' : null
      if (value !== null) entries.push({ user_id: userId, date, row_id: r.id, value })
    }
    if (n % 9 === 3) comments.push({ user_id: userId, date, text: 'Warm night, woke twice.' })
  }
  // Today, partly filled, so the check-in looks in progress.
  const today = day(0)
  for (const [key, value] of [['flow', '0'], ['cramps', '1'], ['breast', '0'], ['headache', '2'], ['joint_pain', '1'], ['flush_day_n', '2']]) {
    const r = rows.find((x) => x.key === key)
    if (r) entries.push({ user_id: userId, date: today, row_id: r.id, value })
  }
  await admin.from('entries').insert(entries)
  await admin.from('day_comments').insert(comments)

  await page.reload()
  await page.waitForSelector('.rows')
  await page.waitForTimeout(800)
  await webp(await page.screenshot(), 'tonight', 600)

  await page.click('nav.tabs button:has-text("Care team")')
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(800)
  await webp(await page.screenshot(), 'care-team', 600)

  await page.click('nav.tabs button:has-text("Trends")')
  await page.waitForSelector('.trends figure')
  await page.waitForTimeout(800)
  await webp(await page.screenshot(), 'trends', 600)

  await page.click('nav.tabs button:has-text("Month")')
  await page.waitForSelector('.month-grid')
  await page.waitForTimeout(800)
  await webp(await page.screenshot(), 'month', 600)

  // The link preview image: the landing page's hero, signed out.
  const visitor = await browser.newContext({ viewport: { width: 1200, height: 630 } })
  await visitor.addInitScript(() => localStorage.setItem('pd-install-dismissed', '1'))
  const landing = await visitor.newPage()
  await landing.goto(APP)
  await landing.waitForSelector('.landing-hero img')
  await landing.waitForTimeout(1200)
  await sharp(await landing.screenshot()).png({ compressionLevel: 9 }).toFile(`${OUT}/og.png`)
  await visitor.close()
  console.log('Screenshots written to public/landing/.')
} finally {
  await browser.close()
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Deleted the demo account.')
}
