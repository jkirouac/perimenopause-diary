import type { Category } from '../lib/diary'

// Line icons in pastel rounded squares beside each section heading (Harmoni).
export function SectionIcon({ id }: { id: Category }) {
  const paths: Record<Category, string> = {
    physical: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
    flushes: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1.5-5 0-7.5Z',
    sleep: 'M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z',
    thinking: 'M7 17a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8a3.5 3.5 0 0 1 .5 7H7ZM9 20h6',
    mood: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM9 10h.01M15 10h.01M8.5 14a4 4 0 0 0 7 0',
    other: 'M6 12h.01M12 12h.01M18 12h.01',
    compared: 'M8 19V6M5 9l3-3 3 3M16 5v13M13 15l3 3 3-3',
    meds: 'M8.5 15.5l7-7a3.5 3.5 0 0 0-5-5l-7 7a3.5 3.5 0 0 0 5 5ZM7 7l5 5',
    measures: 'M4 17 17 4l3 3L7 20ZM8 13l1.5 1.5M11 10l1.5 1.5M14 7l1.5 1.5',
  }
  return (
    <span className="tile" aria-hidden="true">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={paths[id]} />
      </svg>
    </span>
  )
}
