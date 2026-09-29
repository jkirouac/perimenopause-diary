import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { CREDIT } from '../lib/diary'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (error) {
      setError(
        error.status === 429
          ? 'Too many sign-in emails were sent in the last hour. Wait a little and try again.'
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
      <h1>Daily Perimenopause Diary</h1>
      <p className="muted">Your evening diary, on your phone. Only you can see what you record.</p>
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
          <button className="primary" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p>
            We sent a code to <strong>{email}</strong>. Type it here. It can take a minute to arrive; check spam if
            it doesn't.
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
      <p className="credit">{CREDIT}</p>
    </main>
  )
}
