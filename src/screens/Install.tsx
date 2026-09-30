import { useState } from 'react'
import { useInstall, type InstallPlatform } from '../lib/install'

const DISMISSED = 'pd-install-dismissed'

function Steps({ platform }: { platform: InstallPlatform }) {
  if (platform === 'ios')
    return (
      <p className="small">
        In Safari, tap the <strong>Share</strong> button (the square with an arrow), then{' '}
        <strong>Add to Home Screen</strong>.
      </p>
    )
  if (platform === 'android')
    return (
      <p className="small">
        Tap Chrome's menu (<strong>⋮</strong>, top right), then <strong>Install app</strong> or{' '}
        <strong>Add to Home screen</strong>.
      </p>
    )
  return (
    <p className="small">
      Open this page on your phone, in Chrome on Android or Safari on iPhone, and add it to your home screen from
      there.
    </p>
  )
}

// A slim banner at the top of Tonight, only in a browser tab. "Not now" hides it for
// good on this phone; Settings keeps the same option.
export function InstallBanner() {
  const install = useInstall()
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === '1'
    } catch {
      return false
    }
  })
  const [showSteps, setShowSteps] = useState(false)
  if (install.installed || hidden) return null
  function notNow() {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // Storage blocked: it stays hidden until the page is reloaded.
    }
    setHidden(true)
  }
  return (
    <aside className="install-banner" aria-label="Install the diary">
      <div className="install-banner-row">
        <p>
          <strong>Add the diary to your home screen</strong>
          <span className="muted small">Opens like an app, and works without internet.</span>
        </p>
        <div className="install-actions">
          <button className="primary" onClick={() => (install.canPrompt ? install.prompt() : setShowSteps(true))}>
            Install
          </button>
          <button className="link" onClick={notNow}>
            Not now
          </button>
        </div>
      </div>
      {showSteps && !install.canPrompt && <Steps platform={install.platform} />}
    </aside>
  )
}

// The same option as a card, for the sign-in screen and Settings.
export function InstallCard({ heading = 'Put the diary on your home screen' }: { heading?: string }) {
  const install = useInstall()
  if (install.installed) return null
  return (
    <section className="section install-card">
      <h2>{heading}</h2>
      <p className="legend">It opens like an app, in its own window, and works without internet.</p>
      {install.canPrompt ? (
        <button className="primary" onClick={() => install.prompt()}>
          Install the diary
        </button>
      ) : (
        <Steps platform={install.platform} />
      )}
    </section>
  )
}
