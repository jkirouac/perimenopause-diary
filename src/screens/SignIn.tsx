import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT } from '../lib/diary'
import { InstallCard } from './Install'
import { useTurnstile } from '../lib/turnstile'

export function SignIn({ onAbout }: { onAbout?: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const robotCheck = useTurnstile()

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: robotCheck.token ? { captchaToken: robotCheck.token } : undefined,
    })
    setBusy(false)
    robotCheck.reset() // Each check can be used once.
    if (error) {
      setError(
        error.status === 429
          ? 'Too many codes were asked for just now. Wait a minute, then try again.'
          : /captcha/i.test(error.message)
            ? 'The quick “not a robot” check didn’t finish. Wait a moment and try again.'
            : `Couldn't send the code: ${error.message}`,
      )
      return
    }
    setStep('code')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError("That code didn't work. Check it against the latest email, or send a new one.")
  }

  return (
    <main className="signin">
      {onAbout && (
        <button type="button" className="link back-link" onClick={onAbout}>
          ← About Ebb &amp; Flow
        </button>
      )}
      <h1 className="brand">Ebb &amp; Flow</h1>
      <p className="muted">
        Based on CeMCOR’s Daily Perimenopause Diary. Sign in with your email, and we’ll send you a six-digit code.
      </p>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="stack">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {/* Usually invisible; appears only if Cloudflare needs a tap to confirm. */}
          {robotCheck.enabled && <div ref={robotCheck.ref} className="robot-check" />}
          <button className="primary" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p>
            We sent a code to <strong>{email}</strong>. Type it here within ten minutes. It can take a minute to
            arrive; check spam if it doesn't.
          </p>
          <label htmlFor="code">Code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button className="primary" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="link" onClick={() => setStep('email')}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <InstallCard />
      <p className="credit">{CREDIT}</p>
    </main>
  )
}
