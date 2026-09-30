import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import StatStrip from '../components/StatStrip'
import Charts from '../components/Charts'
import FlagsTable from '../components/FlagsTable'
import DetailModal from '../components/DetailModal'

export default function ConsolePage({ ruleTitle, refreshKey }) {
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState('')
  const [flags, setFlags] = useState({ total: 0, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t) }, [search])

  const loadStats = useCallback(() => {
    api.stats().then((s) => { setStats(s); setStatsError('') }).catch((e) => setStatsError(e.message))
  }, [])

  const loadFlags = useCallback(() => {
    setLoading(true)
    api.flags({ risk_level: risk, status, search: query, flagged_only: !showAll })
      .then((d) => { setFlags(d); setError('') })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [risk, status, query, showAll])

  useEffect(loadFlags, [loadFlags, refreshKey])
  useEffect(loadStats, [loadStats, refreshKey])

  const refreshAll = () => { loadFlags(); loadStats() }

  return (
    <>
      {statsError && <div className="banner-error">{statsError}</div>}
      <StatStrip stats={stats} loading={!stats && !statsError} />
      <Charts stats={stats} />

      <section className="panel table-panel">
        <div className="table-head">
          <div>
            <h2>{showAll ? 'All evaluated transactions' : 'Flagged transactions'}</h2>
            <p className="panel-note">{flags.total} result{flags.total === 1 ? '' : 's'} · sorted by risk score</p>
          </div>
          <button className="btn" onClick={refreshAll}>Refresh</button>
        </div>

        <div className="filters">
          <input className="search" type="search" placeholder="Search by transaction ID or user…" value={search}
                 onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          <label>Risk level
            <select value={risk} onChange={(e) => setRisk(e.target.value)}>
              {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => <option key={v} value={v}>{v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['ALL', 'PENDING', 'REVIEWED', 'CLEARED'].map((v) => <option key={v} value={v}>{v === 'ALL' ? 'All' : v[0] + v.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Include unflagged (low-risk)
          </label>
        </div>

        <FlagsTable items={flags.items} loading={loading} error={error} onOpen={setOpenId}
                    ruleTitle={ruleTitle} onRetry={refreshAll} />
      </section>

      {openId && (
        <DetailModal flagId={openId} ruleTitle={ruleTitle} onClose={() => setOpenId(null)}
                     onChanged={refreshAll} />
      )}
    </>
  )
}
