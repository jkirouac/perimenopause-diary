// Dates are local calendar days stored as YYYY-MM-DD.

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
