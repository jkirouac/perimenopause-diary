// The diary's structure, following CeMCOR's Daily Perimenopause Diary
// (© Jerilynn C. Prior, Centre for Menstrual Cycle and Ovulation Research, UBC),
// with the rows and merges from her own tracker list (2026-09-30).

export type Scale = '0-4' | 'count' | 'MLUYZ' | 'tick' | 'number' | 'bp'

export type Category =
  | 'physical'
  | 'flushes'
  | 'sleep'
  | 'thinking'
  | 'mood'
  | 'other'
  | 'compared'
  | 'meds'
  | 'measures'

export interface DiaryRow {
  id: string
  key: string | null
  label: string
  scale: Scale
  sort: number
  hidden: boolean
  category: string | null
  dose: string
  notes: string
}

export interface StandardRow {
  key: string
  label: string
  scale: Scale
  category: Category
  sort: number
}

// In the order they appear on screen. The sort numbers are also set on existing
// accounts by supabase/migrations/20260930000000_tracker_spec.sql; keep them in step.
export const STANDARD_ROWS: StandardRow[] = [
  { key: 'flow', label: 'Amount of flow', scale: '0-4', category: 'physical', sort: 10 },
  { key: 'cramps', label: 'Cramps', scale: '0-4', category: 'physical', sort: 20 },
  { key: 'breast', label: 'Breast soreness', scale: '0-4', category: 'physical', sort: 30 },
  { key: 'headache', label: 'Headache', scale: '0-4', category: 'physical', sort: 40 },
  { key: 'joint_pain', label: 'Joint pain', scale: '0-4', category: 'physical', sort: 50 },
  { key: 'pain_sleep', label: 'Pain affecting sleep', scale: '0-4', category: 'physical', sort: 60 },
  { key: 'vaginal', label: 'Vaginal pain/dryness', scale: '0-4', category: 'physical', sort: 70 },
  { key: 'constipation', label: 'Constipation', scale: '0-4', category: 'physical', sort: 90 },
  { key: 'mucus', label: 'Mucus secretions', scale: '0-4', category: 'physical', sort: 100 },
  { key: 'flush_day', label: 'Hot flushes – day', scale: '0-4', category: 'flushes', sort: 110 },
  { key: 'flush_day_n', label: '# of flushes – day', scale: 'count', category: 'flushes', sort: 120 },
  { key: 'flush_night', label: 'Hot flushes / night sweats – night', scale: '0-4', category: 'flushes', sort: 130 },
  { key: 'flush_night_n', label: '# of flushes / sweats – night', scale: 'count', category: 'flushes', sort: 140 },
  { key: 'sleep', label: 'Sleep problems', scale: '0-4', category: 'sleep', sort: 150 },
  { key: 'brain_fog', label: 'Brain fog', scale: '0-4', category: 'thinking', sort: 160 },
  { key: 'frustrated', label: 'Irritability / anger / rage', scale: '0-4', category: 'mood', sort: 170 },
  { key: 'mood_swings', label: 'Mood swings / emotionally labile', scale: '0-4', category: 'mood', sort: 180 },
  { key: 'depressed', label: 'Feeling depressed', scale: '0-4', category: 'mood', sort: 190 },
  { key: 'anxious', label: 'Feeling anxious', scale: '0-4', category: 'mood', sort: 200 },
  { key: 'appetite', label: 'Appetite', scale: 'MLUYZ', category: 'compared', sort: 210 },
  { key: 'sex', label: 'Interest in sex', scale: 'MLUYZ', category: 'compared', sort: 220 },
  { key: 'energy', label: 'Feeling of energy', scale: 'MLUYZ', category: 'compared', sort: 230 },
  { key: 'self_worth', label: 'Feeling of self-worth', scale: 'MLUYZ', category: 'compared', sort: 240 },
  { key: 'stress', label: 'Outside stresses', scale: 'MLUYZ', category: 'compared', sort: 250 },
  // Replaced Pimples/acne (0–4) on 2026-09-30.
  { key: 'skin', label: 'Skin clearness', scale: 'MLUYZ', category: 'compared', sort: 260 },
  { key: 'weight', label: 'Weight (lb)', scale: 'number', category: 'measures', sort: 300 },
  { key: 'bp', label: 'Blood pressure', scale: 'bp', category: 'measures', sort: 310 },
]

export const SEVERITY = [
  { value: '0', word: 'none' },
  { value: '1', word: 'minimal' },
  { value: '2', word: 'moderate' },
  { value: '3', word: 'moderately intense' },
  { value: '4', word: 'very intense' },
]

export const COMPARED = [
  { value: 'M', word: 'much less' },
  { value: 'L', word: 'a little less' },
  { value: 'U', word: 'usual' },
  { value: 'Y', word: 'a little more' },
  { value: 'Z', word: 'much more' },
]

export const SEVERITY_LEGEND = '0 none · 1 minimal · 2 moderate · 3 moderately intense · 4 very intense'

// Screen order. Severity sections share one legend, shown above the first of them.
export const SECTIONS: { id: Category; title: string; severity?: boolean; legend?: string }[] = [
  { id: 'physical', title: 'Physical', severity: true },
  { id: 'flushes', title: 'Hot flushes', severity: true },
  { id: 'sleep', title: 'Sleep', severity: true },
  { id: 'thinking', title: 'Thinking', severity: true },
  { id: 'mood', title: 'Mood', severity: true },
  { id: 'other', title: 'Other', severity: true },
  {
    id: 'compared',
    title: 'Compared with usual',
    legend: 'M much less · L a little less · U usual · Y a little more · Z much more',
  },
  { id: 'meds', title: 'Medications and supplements', legend: 'Tick what you took today.' },
  { id: 'measures', title: 'Measurements', legend: 'Whenever you measure. Not needed every day.' },
]

// Groups a person can put their own symptoms in.
export const SYMPTOM_GROUPS: Category[] = ['physical', 'flushes', 'sleep', 'thinking', 'mood', 'other']

export function sectionOf(row: Pick<DiaryRow, 'category' | 'scale'>): Category {
  if (row.category && SECTIONS.some((s) => s.id === row.category)) return row.category as Category
  if (row.scale === 'tick') return 'meds'
  if (row.scale === 'MLUYZ') return 'compared'
  if (row.scale === 'number' || row.scale === 'bp') return 'measures'
  return 'other'
}

export function sectionTitle(id: Category): string {
  return SECTIONS.find((s) => s.id === id)?.title ?? id
}

export const SCALE_NAMES: Record<Scale, string> = {
  '0-4': '0–4 strength',
  count: 'Count',
  MLUYZ: 'Compared with usual (M–Z)',
  tick: 'Taken / not taken',
  number: 'Number',
  bp: 'Blood pressure',
}

// The value "Mark the rest as none" fills in, or null when a row is left alone.
export function noneValue(scale: Scale): string | null {
  if (scale === '0-4' || scale === 'count') return '0'
  if (scale === 'MLUYZ') return 'U'
  return null
}

// Body mass index from pounds and inches, to one decimal place.
export function bmi(pounds: number, heightIn: number): string {
  return ((703 * pounds) / (heightIn * heightIn)).toFixed(1)
}

// Blood pressure is stored as "top/bottom", e.g. "120/80".
export function parseBp(value: string | undefined): { top: number; bottom: number } | null {
  const m = /^(\d{2,3})\/(\d{2,3})$/.exec(value ?? '')
  return m ? { top: Number(m[1]), bottom: Number(m[2]) } : null
}

export const CREDIT =
  'Based on the Daily Perimenopause Diary © Jerilynn C. Prior, Centre for Menstrual Cycle and Ovulation Research (CeMCOR), University of British Columbia. cemcor.ubc.ca'
