import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { prettify } from '../utils/format'

// Rule titles come from the backend, so a newly added rule shows up with no frontend change.
export function useRules() {
  const [titles, setTitles] = useState({})
  useEffect(() => {
    api.health()
      .then((h) => setTitles(Object.fromEntries(h.rules_loaded.map((r) => [r.name, r.title || prettify(r.name)]))))
      .catch(() => {})
  }, [])
  return (name) => titles[name] || prettify(name)
}
