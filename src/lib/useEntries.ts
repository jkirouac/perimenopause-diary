import { useCallback, useEffect, useState } from 'react'
import { cleanExtra, loadEntries, queue, type Entries, type Extra } from './store'

export function useEntries(from: string, to: string) {
  const [entries, setEntries] = useState<Entries | null>(null)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    loadEntries(from, to)
      .then((e) => {
        setEntries(e)
        setError('')
      })
      .catch(() => setError("Couldn't load your diary. Check your connection and try again."))
  }, [from, to])

  useEffect(() => {
    setEntries(null)
    reload()
  }, [reload])

  const setValue = useCallback((date: string, rowId: string, value: string | null, extra?: Extra | null) => {
    const kept = value === null ? null : cleanExtra(extra)
    setEntries((prev) => {
      if (!prev) return prev
      const day = { ...(prev.values[date] ?? {}) }
      const dayExtras = { ...(prev.extras[date] ?? {}) }
      if (value === null) delete day[rowId]
      else day[rowId] = value
      if (kept) dayExtras[rowId] = kept
      else delete dayExtras[rowId]
      return {
        ...prev,
        values: { ...prev.values, [date]: day },
        extras: { ...prev.extras, [date]: dayExtras },
      }
    })
    queue({ kind: 'entry', date, rowId, value, extra: kept })
  }, [])

  const setComment = useCallback((date: string, text: string) => {
    setEntries((prev) => (prev ? { ...prev, comments: { ...prev.comments, [date]: text } } : prev))
    queue({ kind: 'comment', date, text })
  }, [])

  return { entries, error, reload, setValue, setComment }
}
