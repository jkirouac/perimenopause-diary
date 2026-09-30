import type { ReactNode } from 'react'
import { CREDIT, type Category } from '../lib/diary'
import { InstallCard } from './Install'
import { SectionIcon } from './SectionIcon'

// The page a signed-out visitor sees in a browser tab: what Ebb & Flow is, how it
// differs, and how private it is. Shared by link with friends and her patients, so it
// explains rather than sells (DESIGN.md, Landing page). The installed app skips it.

const shot = (name: string) => `${import.meta.env.BASE_URL}landing/${name}.webp`

function Phone({ name, alt }: { name: string; alt: string }) {
  return (
    <figure className="phone">
      <img src={shot(name)} alt={alt} width={390} height={844} loading="lazy" />
    </figure>
  )
}

function Cta({ onStart }: { onStart: () => void }) {
  return (
    <div className="cta">
      <button className="primary" onClick={onStart}>
        Start your diary
      </button>
      <button className="link" onClick={onStart}>
        I already have one: sign in
      </button>
    </div>
  )
}

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'No predictions',
    body: 'Cycles change in perimenopause. Ebb & Flow records what happened and never guesses what comes next.',
  },
  {
    title: 'A few minutes a night',
    body: 'Rate each symptom from 0 to 4, like the Menopause Rating Scale clinicians use. One tap each, then you’re done.',
  },
  {
    title: 'A hot flush, the moment it happens',
    body: 'Tap +1 when one starts, day or night, instead of trying to remember them all by bedtime.',
  },
  {
    title: 'Skip a night, no guilt',
    body: 'Catch up on yesterday, or leave it blank. Blank means not recorded, which is different from none.',
  },
]

const TRACKS: { id: Category; title: string; body: string }[] = [
  {
    id: 'physical',
    title: 'Physical',
    body: 'Flow, cramps, breast soreness, headaches, joint pain, pain that disturbs sleep, vaginal pain or dryness',
  },
  { id: 'flushes', title: 'Hot flushes', body: 'Day and night, including night sweats, with a count of each' },
  { id: 'sleep', title: 'Sleep', body: 'How much trouble you had sleeping' },
  { id: 'thinking', title: 'Thinking', body: 'Brain fog, memory and focus' },
  { id: 'mood', title: 'Mood', body: 'Irritability, mood swings, low mood and anxiety' },
  { id: 'compared', title: 'Compared with usual', body: 'Appetite, interest in sex, energy, self-worth, stress and skin' },
  { id: 'meds', title: 'Medications and supplements', body: 'What you took, when, and the dose if it changed' },
  { id: 'measures', title: 'Measurements', body: 'Weight with BMI, and blood pressure, whenever you check' },
]

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: 'My periods are irregular, or have stopped. Is this for me?',
    a: 'Yes. Ebb & Flow tracks symptoms by calendar day and never predicts a period, so it works however your cycle behaves.',
  },
  {
    q: 'What if I skip a night?',
    a: 'Fill in yesterday the next day, or leave it blank. Blank means not recorded, and 0 means none, so your record stays accurate.',
  },
  {
    q: 'Is this medical advice?',
    a: 'No. It’s a diary to help you and your care team see what’s happening. Bring questions about symptoms or treatment to them.',
  },
  {
    q: 'How do I sign in?',
    a: 'With your email. You get a six-digit code each time, so there’s no password to remember.',
  },
  {
    q: 'Does it work on iPhone and Android?',
    a: 'Yes. It runs in your phone’s browser, and you can add it to your home screen so it opens like an app, even offline.',
  },
  {
    q: 'Can I get my data out, or delete it?',
    a: 'Yes. Settings lets you download everything as a spreadsheet, or delete your account and diary for good.',
  },
  {
    q: 'Who made it?',
    a: 'Jeremy Kirouac, in Victoria, BC. He made it for his wife, a nurse practitioner who kept the paper diary.',
  },
]

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main className="landing">
      <header className="landing-hero">
        <div className="landing-hero-text">
          <p className="eyebrow">Based on CeMCOR’s Daily Perimenopause Diary</p>
          <h1 className="brand">Ebb &amp; Flow</h1>
          <p className="tagline">
            A calm <em className="emph">evening</em> check-in for perimenopause.
          </p>
          <p className="lede">
            A few minutes each night to note how your body and mood were. Free, private, and made for cycles that
            don’t keep to a schedule.
          </p>
          <Cta onStart={onStart} />
        </div>
        <Phone name="tonight" alt="The evening check-in: a lavender header asking How was today, and symptoms rated 0 to 4" />
      </header>

      <section className="landing-section" aria-labelledby="made-for">
        <h2 id="made-for">Made for how perimenopause actually goes</h2>
        <ul className="feature-cards">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="track">
        <h2 id="track">What you can track</h2>
        <ul className="track-list">
          {TRACKS.map((t) => (
            <li key={t.id}>
              <SectionIcon id={t.id} />
              <div>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="muted">Hide anything you don’t need, and add your own symptoms and treatments.</p>
      </section>

      <section className="landing-section landing-split" aria-labelledby="care-team">
        <div>
          <h2 id="care-team">Bring it to your care team</h2>
          <p>
            Each month becomes a one-page copy in the layout of CeMCOR’s paper diary, ready for your nurse
            practitioner, doctor, midwife or anyone who supports your care. Print it, or save it as a PDF to email.
            Nothing is sent from the app.
          </p>
        </div>
        <Phone name="care-team" alt="The copy for your care team: a month grid of symptoms by day" />
      </section>

      <section className="landing-section landing-split reverse" aria-labelledby="patterns">
        <div>
          <h2 id="patterns">See your patterns</h2>
          <p>
            The month grid shows every day at a glance. Trends chart each symptom over 30 days or three months, with
            the days you took each medication marked.
          </p>
        </div>
        <Phone name="trends" alt="Trends: line charts of symptoms over the last 30 days" />
      </section>

      <section className="landing-section" aria-labelledby="private">
        <h2 id="private">Private by design</h2>
        <ul className="plain-list">
          <li>Your diary is stored in Canada, and only you can see it in the app.</li>
          <li>Nothing is sold or shared. No ads, no tracking, and no AI reading your entries.</li>
          <li>It works without internet and catches up when you’re back online.</li>
          <li>Download everything as a spreadsheet, or delete your account and diary at any time.</li>
        </ul>
      </section>

      <section className="landing-section" aria-labelledby="free">
        <h2 id="free">Free, with thanks to CeMCOR</h2>
        <p>
          Ebb &amp; Flow follows the Daily Perimenopause Diary created by Dr. Jerilynn C. Prior at the Centre for
          Menstrual Cycle and Ovulation Research (CeMCOR), University of British Columbia. CeMCOR shares the diary
          for personal and clinical use at no cost, so Ebb &amp; Flow is free too.
        </p>
        <p>
          <a href="https://cemcor.ubc.ca/resources/daily-perimenopause-diary/" target="_blank" rel="noreferrer">
            Read CeMCOR’s guide to the diary
          </a>
        </p>
      </section>

      <InstallCard heading="Put Ebb & Flow on your home screen" />

      <section className="landing-section" aria-labelledby="questions">
        <h2 id="questions">Questions</h2>
        <div className="faq">
          {QUESTIONS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-section landing-close">
        <h2>Ready when you are</h2>
        <Cta onStart={onStart} />
      </section>

      <footer className="landing-footer">
        <p>Ebb &amp; Flow is a diary, not medical advice.</p>
        <p>{CREDIT}</p>
      </footer>
    </main>
  )
}
