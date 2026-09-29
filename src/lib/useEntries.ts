import { useCallback, useEffect, useState } from 'react'
import { loadEntries, queue, type Entries } from './store'

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

  const setValue = useCallback((date: string, rowId: string, value: string | null) => {
    setEntries((prev) => {
      if (!prev) return prev
      const day = { ...(prev.values[date] ?? {}) }
      if (value === null) delete day[rowId]
      else day[rowId] = value
      return { ...prev, values: { ...prev.values, [date]: day } }
    })
    queue({ kind: 'entry', date, rowId, value })
  }, [])

  const setComment = useCallback((date: string, text: string) => {
    setEntries((prev) => (prev ? { ...prev, comments: { ...prev.comments, [date]: text } } : prev))
    queue({ kind: 'comment', date, text })
  }, [])

  return { entries, error, reload, setValue, setComment }
}
