// Cloudflare Turnstile: a "not a robot" check before a sign-in code is sent, so nobody
// can use the app to spam addresses or use up the email quota. Usually invisible.
// Off until a site key is set (VITE_TURNSTILE_SITE_KEY); local development uses
// Cloudflare's always-pass test key.

import { useEffect, useRef, useState } from 'react'

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TEST_SITE_KEY = '1x00000000000000000000AA'
const SITE_KEY: string | undefined = import.meta.env.DEV
  ? TEST_SITE_KEY
  : (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || undefined
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loading: Promise<TurnstileApi> | null = null
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')))
    script.onerror = () => reject(new Error('Turnstile failed to load'))
    document.head.appendChild(script)
  })
  return loading
}

// Renders the check into the returned ref. `token` is null until it passes; `reset`
// gets a fresh token after one has been used.
export function useTurnstile() {
  const ref = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const enabled = Boolean(SITE_KEY)

  useEffect(() => {
    if (!enabled || !ref.current) return
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return
        widget.current = api.render(ref.current, {
          sitekey: SITE_KEY,
          appearance: 'interaction-only',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
        })
      })
      .catch(() => undefined) // Offline or blocked: the server will say so if a token was needed.
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [enabled])

  const reset = () => {
    setToken(null)
    if (widget.current) window.turnstile?.reset(widget.current)
  }
  return { ref, token, enabled, reset }
}
