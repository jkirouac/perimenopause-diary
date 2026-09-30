// Dates are local calendar days stored as YYYY-MM-DD.

import { useEffect, useState } from 'react'

export function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDay(s)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}

export function today(): string {
  return isoDay(new Date())
}

// Today's date, re-read whenever the app comes back to the front. A phone can keep
// the app open in the background for days, so the date from when a screen first
// opened can't be trusted. It doesn't change while the app stays in front, so a
// diary filled in across midnight stays on the day it was started.
export function useToday(): string {
  const [day, setDay] = useState(today)
  useEffect(() => {
    const check = () => setDay(today())
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])
  return day
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  return {
    from: isoDay(new Date(year, month, 1)),
    to: isoDay(new Date(year, month, daysInMonth(year, month))),
  }
}

export function longDate(s: string): string {
  return parseDay(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function monthName(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Night flushes are the ones while asleep; before 7 am or from 10 pm counts as night.
export function isNightNow(): boolean {
  const h = new Date().getHours()
  return h >= 22 || h < 7
}
