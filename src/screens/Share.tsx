import { useState } from 'react'

// The landing page, with nothing added: no referral codes, so nobody learns who shared it.
const LINK = new URL(import.meta.env.BASE_URL, location.origin).href
// The same words as og:description in index.html; keep them true of what's built.
const TEXT = "A calm evening check-in for perimenopause, based on CeMCOR's Daily Perimenopause Diary. Free and private."

// Shares the app, never the diary. Settings only: the app never asks her to share (DESIGN.md, Avoid).
export function ShareCard() {
  const [status, setStatus] = useState('')
  const [showLink, setShowLink] = useState(false)
  async function share() {
    setStatus('')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ebb & Flow', text: TEXT, url: LINK })
        return
      } catch (e) {
        // She closed the share sheet: nothing to say.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(LINK)
      setStatus('Link copied.')
    } catch {
      setStatus("Couldn't copy the link. Press and hold it below to copy it yourself.")
      setShowLink(true)
    }
  }
  return (
    <section className="section">
      <h2>Share Ebb &amp; Flow</h2>
      <p className="legend">
        Send the link to a friend or a patient. It opens a page about the diary. Nothing from your diary is shared.
      </p>
      <button onClick={share}>Share the link</button>
      {status && <p className="muted small">{status}</p>}
      {showLink && <p className="share-link">{LINK}</p>}
    </section>
  )
}
