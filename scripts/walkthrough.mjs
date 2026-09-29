// Walks through the app like a person would on a phone, checks the key rules,
// and saves screenshots. Uses a throwaway account that is deleted at the end.
// Run with the dev server up: node --env-file=.env.local scripts/walkthrough.mjs <screenshot-dir>
// Against the live site: set APP_URL=https://jkirouac.github.io/perimenopause-diary/

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const APP = process.env.APP_URL ?? 'http://localhost:5173/perimenopause-diary/'
const out = process.argv[2] ?? 'walkthrough'
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const email = `walkthrough-${Date.now()}@example.com`
let userId
let failures = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

const browser = await chromium.launch()
try {
  await admin.auth.admin.createUser({ email, email_confirm: true })
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  userId = link.user.id
  const code = link.properties.email_otp

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  // Don't send a real email; the code comes from the admin API instead.
  await page.route('**/auth/v1/otp**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  await page.goto(APP)
  await page.screenshot({ path: `${out}/01-sign-in.png` })
  await page.fill('#email', email)
  await page.click('text=Email me a sign-in code')
  await page.fill('#code', code)
  await page.click('button:has-text("Sign in")')
  await page.waitForSelector('text=Hot flush just now?', { timeout: 20000 }).catch(() => {})
  await page.waitForSelector('.rows')

  const dayButtons = await page.locator('.seg button').allTextContents()
  check('Only Today and Yesterday can be chosen', dayButtons.join('|') === 'Today|Yesterday')

  const headache = page.locator('.row', { hasText: 'Headache' })
  await headache.getByRole('button', { name: '2, moderate' }).click()
  const energy = page.locator('.row', { hasText: 'Feeling of energy' })
  await energy.getByRole('button', { name: 'a little less' }).click()
  await page.screenshot({ path: `${out}/02-tonight-top.png` })

  const flushCard = page.locator('.flush-card')
  if (await flushCard.count()) {
    await flushCard.getByRole('button', { name: '+1' }).click()
    await flushCard.getByRole('button', { name: '+1' }).click()
  }

  const progress = async () => (await page.locator('.day-head p.muted').textContent()) ?? ''
  await page.click('button:has-text("Mark the other")')
  const p = await progress()
  const [filled, total] = p.match(/(\d+) of (\d+)/).slice(1).map(Number)
  check(`"Mark the rest as none" fills every row (${filled} of ${total})`, filled === total)
  check('A tapped value is kept after "mark the rest"', (await headache.locator('[aria-pressed="true"]').textContent()) === '2')

  await page.fill('#comment', 'Walkthrough test day')
  await page.locator('h1').click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${out}/03-tonight-filled.png`, fullPage: true })

  // Saved to the server?
  const { data: saved } = await admin.from('entries').select('value, diary_rows(key)').eq('user_id', userId)
  const byKey = Object.fromEntries(saved.map((e) => [e.diary_rows.key, e.value]))
  check('Headache 2 reached the server', byKey.headache === '2')
  check('Energy "L" reached the server', byKey.energy === 'L')
  check('Untouched rows saved as 0 / U', byKey.cramps === '0' && byKey.stress === 'U')
  const { data: comment } = await admin.from('day_comments').select('text').eq('user_id', userId)
  check('Comment reached the server', comment[0]?.text === 'Walkthrough test day')

  // Blank vs 0: tapping the chosen value again clears it.
  await headache.getByRole('button', { name: '2, moderate' }).click()
  await page.waitForTimeout(1200)
  const { data: cleared } = await admin
    .from('entries')
    .select('value, diary_rows!inner(key)')
    .eq('user_id', userId)
    .eq('diary_rows.key', 'headache')
  check('Tapping a chosen value again clears it to blank', cleared.length === 0)

  // Offline save, then sync.
  await context.setOffline(true)
  await headache.getByRole('button', { name: '3, moderately intense' }).click()
  await page.waitForSelector('.offline', { timeout: 8000 }).catch(() => {})
  check('Offline save shows the "saved on this phone" note', (await page.locator('.offline').count()) === 1)
  await page.screenshot({ path: `${out}/04-offline.png` })
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(4000)
  const { data: synced } = await admin
    .from('entries')
    .select('value, diary_rows!inner(key)')
    .eq('user_id', userId)
    .eq('diary_rows.key', 'headache')
  check('Offline save reached the server once back online', synced[0]?.value === '3')
  check('Offline note goes away after syncing', (await page.locator('.offline').count()) === 0)

  // Reload keeps everything.
  await page.reload()
  await page.waitForSelector('.rows')
  check('Values survive a reload', (await headache.locator('[aria-pressed="true"]').textContent()) === '3')

  // Yesterday.
  await page.click('.seg button:has-text("Yesterday")')
  await page.waitForTimeout(500)
  check('Yesterday starts blank', (await progress()).startsWith('0 of'))
  await page.screenshot({ path: `${out}/05-yesterday.png` })

  for (const [tab, file] of [
    ['Month', '06-month'],
    ['Trends', '07-trends'],
    ['For doctor', '08-doctor'],
    ['Settings', '09-settings'],
  ]) {
    await page.click(`nav.tabs button:has-text("${tab}")`)
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${out}/${file}.png`, fullPage: tab !== 'Settings' })
  }

  // Settings: hide a row, add a custom row and a treatment.
  const fluid = page.locator('.row-edit').filter({ has: page.locator('input[value="Fluid retention"]') })
  await fluid.getByRole('button', { name: 'Shown' }).click()
  await page.fill('#add-0-4MLUYZcountnumber', 'Ringing in the ears')
  await page.locator('.add-row').first().getByRole('button', { name: 'Add' }).click()
  await page.fill('#add-tick', 'VitaminD')
  await page.locator('.add-row').nth(1).getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(1500)
  await page.click('nav.tabs button:has-text("Tonight")')
  await page.waitForTimeout(800)
  check('Hidden row leaves Tonight', (await page.locator('.row', { hasText: 'Fluid retention' }).count()) === 0)
  check('Custom row appears on Tonight', (await page.locator('.row', { hasText: 'Ringing in the ears' }).count()) === 1)
  check('Treatment appears on Tonight', (await page.locator('.row', { hasText: 'VitaminD' }).count()) === 1)
  await page.screenshot({ path: `${out}/10-tonight-after-settings.png`, fullPage: true })

  // Dark mode.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: `${out}/11-dark.png` })
  await page.emulateMedia({ colorScheme: 'light' })

  // Doctor printout, as a landscape PDF-style page.
  const printPage = await context.newPage()
  await printPage.setViewportSize({ width: 1100, height: 800 })
  await printPage.goto(`${APP}#doctor`)
  await printPage.waitForSelector('.sheet', { timeout: 15000 })
  await printPage.emulateMedia({ media: 'print' })
  await printPage.screenshot({ path: `${out}/12-doctor-print.png`, fullPage: true })
  await printPage.pdf({ path: `${out}/doctor-copy.pdf`, landscape: true, printBackground: true })

  if (APP.startsWith('https://')) {
    const sw = await page.evaluate(() =>
      Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 10000))]),
    )
    check('Offline support (service worker) is active', sw === true)
  }
  check('No script errors on any screen', errors.length === 0)
  if (errors.length) console.log(errors)
} finally {
  await browser.close()
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Deleted the walkthrough account.')
}
console.log(failures === 0 ? 'All walkthrough checks passed.' : `${failures} walkthrough check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
