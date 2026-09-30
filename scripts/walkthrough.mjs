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

  // A comment typed and left, with no tap elsewhere, still saves.
  await page.fill('#comment', 'Typed and left')
  await page.waitForTimeout(3000)
  const { data: leftComment } = await admin.from('day_comments').select('text').eq('user_id', userId).eq('text', 'Typed and left')
  check('A comment saves without leaving the box', leftComment.length === 1)

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
  const constipation = page.locator('.row-edit').filter({ has: page.locator('input[value="Constipation"]') })
  await constipation.getByRole('button', { name: 'Shown' }).click()
  await page.fill('#add-0-4MLUYZcountnumber', 'Ringing in the ears')
  await page.locator('.add-row').first().getByRole('button', { name: 'Add' }).click()
  await page.fill('#add-tick', 'VitaminD')
  await page.locator('.add-row').nth(1).getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(1500)
  await page.click('nav.tabs button:has-text("Tonight")')
  await page.waitForTimeout(800)
  check('Hidden row leaves Tonight', (await page.locator('.row', { hasText: 'Constipation' }).count()) === 0)
  check('Custom row appears on Tonight', (await page.locator('.row', { hasText: 'Ringing in the ears' }).count()) === 1)
  check('Treatment appears on Tonight', (await page.locator('.row', { hasText: 'VitaminD' }).count()) === 1)
  await page.screenshot({ path: `${out}/10-tonight-after-settings.png`, fullPage: true })

  // Tonight is grouped like her tracker list.
  const headings = await page.locator('main h2').allTextContents()
  check(
    `Tonight has the list's groups (${headings.join(', ')})`,
    ['Physical', 'Hot flushes', 'Sleep', 'Thinking', 'Mood', 'Compared with usual', 'Medications and supplements', 'Measurements'].every(
      (h) => headings.includes(h),
    ),
  )
  const labels = await page.locator('.row-label').allTextContents()
  check(
    'The merged and new rows are there',
    ['Breast soreness', 'Joint pain', 'Pain affecting sleep', 'Vaginal pain/dryness', 'Skin clearness', 'Brain fog',
      'Irritability / anger / rage', 'Mood swings / emotionally labile', 'Hot flushes / night sweats – night',
      'Weight (lb)', 'Blood pressure'].every((l) => labels.some((x) => x.startsWith(l))),
  )
  check('The old split breast rows are gone', !labels.some((x) => x.startsWith('Breast sore –')))
  check('Pimples/acne is replaced by Skin clearness', !labels.some((x) => x.startsWith('Pimples')))

  const rowId = async (label) =>
    (await admin.from('diary_rows').select('id').eq('user_id', userId).eq('label', label).single()).data.id
  const todayEntry = async (label) =>
    (await admin.from('entries').select('value, extra').eq('user_id', userId).eq('row_id', await rowId(label)).maybeSingle()).data

  // A medication: taken, with a time and a different dose.
  await page.locator('.med', { hasText: 'VitaminD' }).getByRole('button', { name: 'Not taken' }).click()
  await page.getByLabel('Time you took VitaminD').fill('08:30')
  await page.getByLabel('Dose of VitaminD today').fill('2 pumps')
  await page.waitForTimeout(2500)
  const med = await todayEntry('VitaminD')
  check('A medication saves its time and dose', med?.value === '1' && med?.extra?.time === '08:30' && med?.extra?.dose === '2 pumps')

  // Blood pressure.
  await page.getByLabel('Top number (systolic)').fill('118')
  await page.getByLabel('Bottom number (diastolic)').fill('76')
  await page.waitForTimeout(2500)
  check('Blood pressure saves as top/bottom', (await todayEntry('Blood pressure'))?.value === '118/76')

  // Weight and BMI, once a height is set.
  await page.click('nav.tabs button:has-text("Settings")')
  await page.getByLabel('Height, feet').fill('5')
  await page.getByLabel('Height, inches').fill('6')
  await page.locator('h1').click()
  await page.waitForTimeout(1500)
  await page.click('nav.tabs button:has-text("Tonight")')
  await page.getByLabel('Weight (lb)').fill('150')
  await page.waitForTimeout(2500)
  check('Weight saves', (await todayEntry('Weight (lb)'))?.value === '150')
  check('BMI is worked out from weight and height (24.2)', (await page.locator('text=BMI 24.2').count()) === 1)
  await page.screenshot({ path: `${out}/10b-meds-and-measures.png`, fullPage: true })

  // Moving a treatment up swaps it with the treatment above, not a row in another section.
  await page.click('nav.tabs button:has-text("Settings")')
  await page.fill('#add-tick', 'Magnesium')
  await page.locator('.add-row').nth(1).getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Move Magnesium up' }).click()
  await page.waitForTimeout(1500)
  const treatmentGroup = page.locator('.settings-group', { hasText: 'Medications and supplements' })
  const treatmentOrder = await treatmentGroup.locator('input[aria-label="Row name"]').evaluateAll((els) => els.map((e) => e.value))
  check(`Move up works inside a section (${treatmentOrder.join(', ')})`, treatmentOrder.join('|') === 'Magnesium|VitaminD')
  check('First row of a section can’t move up', await page.getByRole('button', { name: 'Move Magnesium up' }).isDisabled())

  // Retiring a medication hides it from Tonight but keeps its history.
  const VitaminD = page.locator('.row-edit').filter({ has: page.locator('input[value="VitaminD"]') })
  await VitaminD.getByRole('button', { name: 'In use' }).click()
  await page.waitForTimeout(1500)
  await page.click('nav.tabs button:has-text("Tonight")')
  await page.waitForTimeout(800)
  check('A retired medication leaves Tonight', (await page.locator('.med', { hasText: 'VitaminD' }).count()) === 0)
  await page.click('nav.tabs button:has-text("Month")')
  await page.waitForTimeout(1500)
  const VitaminDRow = page.locator('.month-grid tr', { has: page.locator('th', { hasText: 'VitaminD' }) })
  check('…and its ticks stay in the month grid', (await VitaminDRow.locator('td', { hasText: '✓' }).count()) === 1)

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
  // More than the server's 1,000 rows per request: 94 earlier days of every row.
  const { data: rowList } = await admin.from('diary_rows').select('id, key').eq('user_id', userId).eq('scale', '0-4')
  const back = (n) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const bulk = []
  for (let n = 2; n <= 95; n++) for (const r of rowList) bulk.push({ user_id: userId, date: back(n), row_id: r.id, value: '1' })
  await admin.from('entries').insert(bulk)
  const allDates = []
  for (let first = 0; ; first += 1000) {
    const { data } = await admin.from('entries').select('date').eq('user_id', userId).order('date').order('row_id').range(first, first + 999)
    allDates.push(...data)
    if (data.length < 1000) break
  }
  const { data: commentDates } = await admin.from('day_comments').select('date').eq('user_id', userId)
  const expectedDays = new Set([...allDates, ...commentDates].map((r) => r.date)).size
  await page.reload()
  await page.click('nav.tabs button:has-text("Trends")')
  await page.click('.seg button:has-text("Last 3 months")')
  await page.waitForTimeout(3000)
  const headacheCaption = await page.locator('figure.spark', { hasText: 'Headache' }).locator('figcaption').textContent()
  // Seeded days 2–89 back, plus today's 3; yesterday was cleared.
  check(`Trends shows all 3 months past 1,000 rows (${headacheCaption})`, headacheCaption.includes('89 days'))
  await page.click('nav.tabs button:has-text("Settings")')
  await page.click('button:has-text("Download my diary")')
  await page.waitForSelector('text=/Downloaded \\d+ days/')
  const exported = await page.locator('text=/Downloaded \\d+ days/').textContent()
  check(`Export includes every day (${exported}, expected ${expectedDays})`, exported.includes(`${expectedDays} days`))

  // Signing out with unsent saves asks first instead of deleting them.
  await page.click('nav.tabs button:has-text("Tonight")')
  await page.waitForSelector('.rows')
  await context.setOffline(true)
  await headache.getByRole('button', { name: '4, very intense' }).click()
  await page.click('nav.tabs button:has-text("Settings")')
  const signOutAt = Date.now()
  await page.click('button:has-text("Sign out")')
  await page.waitForSelector('text=reached the server yet', { timeout: 15000 }).catch(() => {})
  const warnedAfter = Date.now() - signOutAt
  check(
    `Sign-out warns about unsent changes within 10 s (${(warnedAfter / 1000).toFixed(1)} s)`,
    (await page.locator('text=reached the server yet').count()) === 1 && warnedAfter < 10000,
  )
  check('…and keeps them on the phone', await page.evaluate(() => JSON.parse(localStorage.getItem('pd-outbox') ?? '[]').length > 0))
  await page.screenshot({ path: `${out}/13-sign-out-warning.png` })
  await context.setOffline(false)
  await page.click('button:has-text("Try again")')
  await page.waitForSelector('#email', { timeout: 10000 }).catch(() => {})
  const { data: sentBeforeSignOut } = await admin
    .from('entries')
    .select('value, diary_rows!inner(key)')
    .eq('user_id', userId)
    .eq('date', back(0))
    .eq('diary_rows.key', 'headache')
  check(
    'Try again sends the change, then signs out',
    sentBeforeSignOut[0]?.value === '4' && (await page.locator('#email').count()) === 1,
  )

  // Coming back to the app on a later day shows the new day, not the old one.
  // Runs last, in its own signed-in window, because the fake clock upsets the sign-in.
  const { data: again } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const laterContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const later = await laterContext.newPage()
  await later.route('**/auth/v1/otp**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await later.goto(APP)
  await later.fill('#email', email)
  await later.click('text=Email me a sign-in code')
  await later.fill('#code', again.properties.email_otp)
  await later.click('button:has-text("Sign in")')
  await later.waitForSelector('.rows')
  const tomorrowEvening = new Date()
  tomorrowEvening.setDate(tomorrowEvening.getDate() + 1)
  tomorrowEvening.setHours(20, 0, 0, 0)
  await later.clock.setFixedTime(tomorrowEvening)
  await later.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await later.waitForTimeout(2000)
  const expectedHead = await later.evaluate(() =>
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
  )
  const shownHead = await later.locator('.day-date').textContent()
  check(`Returning on a new day shows that day (${shownHead})`, shownHead === expectedHead)
  check('…with Today selected', (await later.locator('.seg button[aria-pressed="true"]').textContent()) === 'Today')
  await later.close()

  check('No script errors on any screen', errors.length === 0)
  if (errors.length) console.log(errors)
} finally {
  await browser.close()
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Deleted the walkthrough account.')
}
console.log(failures === 0 ? 'All walkthrough checks passed.' : `${failures} walkthrough check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
