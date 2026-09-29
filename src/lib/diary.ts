// The diary's structure, following CeMCOR's Daily Perimenopause Diary
// (© Jerilynn C. Prior, Centre for Menstrual Cycle and Ovulation Research, UBC).

export type Scale = '0-4' | 'count' | 'MLUYZ' | 'tick' | 'number'

export interface DiaryRow {
  id: string
  key: string | null
  label: string
  scale: Scale
  sort: number
  hidden: boolean
}

export interface StandardRow {
  key: string
  label: string
  scale: Scale
  hidden?: boolean
}

// In the order they appear on the paper form.
export const STANDARD_ROWS: StandardRow[] = [
  { key: 'flow', label: 'Amount of flow', scale: '0-4' },
  { key: 'cramps', label: 'Cramps', scale: '0-4' },
  { key: 'breast_front', label: 'Breast sore – front', scale: '0-4' },
  { key: 'breast_side', label: 'Breast sore – side', scale: '0-4' },
  { key: 'fluid', label: 'Fluid retention', scale: '0-4' },
  { key: 'flush_day', label: 'Hot flushes – day', scale: '0-4' },
  { key: 'flush_day_n', label: '# of flushes – day', scale: 'count' },
  { key: 'flush_night', label: 'Hot flushes – night', scale: '0-4' },
  { key: 'flush_night_n', label: '# of flushes – night', scale: 'count' },
  { key: 'mucus', label: 'Mucus secretions', scale: '0-4' },
  { key: 'constipation', label: 'Constipation', scale: '0-4' },
  { key: 'headache', label: 'Headache', scale: '0-4' },
  { key: 'sleep', label: 'Sleep problems', scale: '0-4' },
  { key: 'frustrated', label: 'Feeling frustrated', scale: '0-4' },
  { key: 'depressed', label: 'Feeling depressed', scale: '0-4' },
  { key: 'anxious', label: 'Feeling anxious', scale: '0-4' },
  { key: 'appetite', label: 'Appetite', scale: 'MLUYZ' },
  { key: 'breast_size', label: 'Breast size', scale: 'MLUYZ' },
  { key: 'sex', label: 'Interest in sex', scale: 'MLUYZ' },
  { key: 'energy', label: 'Feeling of energy', scale: 'MLUYZ' },
  { key: 'self_worth', label: 'Feeling of self-worth', scale: 'MLUYZ' },
  { key: 'stress', label: 'Outside stresses', scale: 'MLUYZ' },
  { key: 'bbt', label: 'Basal temperature', scale: 'number', hidden: true },
  { key: 'cup', label: 'Menstrual cup flow (mL)', scale: 'number', hidden: true },
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

export const SECTIONS: { title: string; scales: Scale[]; legend?: string }[] = [
  {
    title: 'How strong',
    scales: ['0-4', 'count'],
    legend: '0 none · 1 minimal · 2 moderate · 3 moderately intense · 4 very intense',
  },
  {
    title: 'Compared with usual',
    scales: ['MLUYZ'],
    legend: 'M much less · L a little less · U usual · Y a little more · Z much more',
  },
  { title: 'Treatments and supplements', scales: ['tick'], legend: 'Tick what you took today.' },
  { title: 'Measurements', scales: ['number'] },
]

export const SCALE_NAMES: Record<Scale, string> = {
  '0-4': '0–4 strength',
  count: 'Count',
  MLUYZ: 'Compared with usual (M–Z)',
  tick: 'Taken / not taken',
  number: 'Number',
}

// The value "Mark the rest as none" fills in, or null when a row is left alone.
export function noneValue(scale: Scale): string | null {
  if (scale === '0-4' || scale === 'count') return '0'
  if (scale === 'MLUYZ') return 'U'
  return null
}

export const CREDIT =
  'Based on the Daily Perimenopause Diary © Jerilynn C. Prior, Centre for Menstrual Cycle and Ovulation Research (CeMCOR), University of British Columbia. cemcor.ubc.ca'
