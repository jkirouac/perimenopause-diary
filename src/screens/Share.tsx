import { useState } from 'react'

// The landing page, with nothing added: no referral codes, so nobody learns who shared it.
const LINK = new URL(import.meta.env.BASE_URL, location.origin).href
// The same words as og:description in index.html; keep them true of what's built.
const TEXT = "A calm evening check-in for perimenopause, based on CeMCOR's Daily Perimenopause Diary. Free and private."

// Shares the app, never the diary. She chooses to share: the app never asks her to (DESIGN.md, Avoid).
function useShare() {
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
  const feedback = (
    <>
      {status && <p className="muted small" role="status">{status}</p>}
      {showLink && <p className="share-link">{LINK}</p>}
    </>
  )
  return { share, feedback }
}

// Each phone's own share symbol: the box and arrow on Apple devices (iPadOS and Macs say
// Macintosh), the three joined circles on Android and everywhere else.
const APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)

function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {APPLE ? (
        <path d="M12 3v12M8 7l4-4 4 4M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
      ) : (
        <>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        </>
      )}
    </svg>
  )
}

export function ShareCard() {
  const { share, feedback } = useShare()
  return (
    <section className="section">
      <h2>Share Ebb &amp; Flow</h2>
      <p className="legend">
        Send the link to a friend or a patient. It opens a page about the diary. Nothing from your diary is shared.
      </p>
      <button className="share-button" onClick={share}>
        <ShareIcon />
        Share the link
      </button>
      {feedback}
    </section>
  )
}

// The icon at the top right of Tonight. It returns its feedback separately so the
// message can sit below the header row instead of squeezing the Today/Yesterday switch.
export function useShareIcon() {
  const { share, feedback } = useShare()
  const button = (
    <button className="share-icon" onClick={share} aria-label="Share Ebb & Flow" title="Share Ebb & Flow">
      <ShareIcon />
    </button>
  )
  return { button, feedback }
}
