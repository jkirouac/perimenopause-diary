// Checks that every colour pairing in DESIGN.md is easy to read, in light and dark.
// Reads the tokens from src/styles.css. Run: node scripts/check-contrast.mjs [file.css]

import fs from 'node:fs'

const css = fs.readFileSync(process.argv[2] ?? 'src/styles.css', 'utf8')

function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]))
}
const lightBlock = css.match(/:root\s*{([\s\S]*?)\n}/)[1]
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([\s\S]*?)\n  }/)[1]
const themes = { light: tokens(lightBlock), dark: { ...tokens(lightBlock), ...tokens(darkBlock) } }

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [text or mark, background, minimum]. 4.5 for text, 3 for large headings and controls.
const PAIRS = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'surface-warm', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'sev-0', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['accent-ink', 'accent', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'bg', 4.5],
  ['emphasis', 'bg', 3],
  ['emphasis', 'header-to', 3],
  ['ink', 'header-from', 4.5],
  ['ink', 'header-to', 4.5],
  ['muted', 'header-to', 4.5],
  ['gold-ink', 'gold-soft', 4.5],
  ['ink', 'gold-soft', 4.5],
  ['muted', 'gold-soft', 4.5],
  ['ink', 'sev-0', 4.5],
  ['ink', 'sev-1', 4.5],
  ['ink', 'sev-2', 4.5],
  ['ink', 'sev-3', 4.5],
  ['sev-ink-strong', 'sev-4', 4.5],
  ['ink', 'less-2', 4.5],
  ['ink', 'less-1', 4.5],
  ['ink', 'usual', 4.5],
  ['ink', 'more-1', 4.5],
  ['ink', 'more-2', 4.5],
]

let failures = 0
for (const [theme, t] of Object.entries(themes)) {
  console.log(`— ${theme}`)
  for (const [fg, bg, min] of PAIRS) {
    if (!t[fg] || !t[bg]) {
      console.log(`FAIL  ${fg} on ${bg}: token missing`)
      failures++
      continue
    }
    const r = ratio(t[fg], t[bg])
    const ok = r >= min
    if (!ok) failures++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${fg} on ${bg}: ${r.toFixed(2)} (needs ${min})`)
  }
}
// The 0–4 ramp must get steadily darker in light mode and lighter in dark mode.
for (const [theme, t] of Object.entries(themes)) {
  const l = ['sev-0', 'sev-1', 'sev-2', 'sev-3', 'sev-4'].map((k) => luminance(t[k]))
  const steady = l.every((v, i) => i === 0 || (theme === 'light' ? v < l[i - 1] : v > l[i - 1]))
  if (!steady) failures++
  console.log(`${steady ? 'PASS' : 'FAIL'}  0–4 ramp is in order (${theme})`)
}
console.log(failures ? `${failures} contrast check(s) failed.` : 'All contrast checks passed.')
process.exit(failures ? 1 : 0)
