import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { RiskBadge, StatusBadge } from '../components/Badges'
import DetailModal from '../components/DetailModal'
import { formatTime, money } from '../utils/format'

const DAY_MS = 24 * 60 * 60 * 1000

export default function TransactionsPage({ searchTerm = '', ruleTitle }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(searchTerm)
  const [risk, setRisk] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('ALL')
  const [openId, setOpenId] = useState(null)

  useEffect(() => { setSearch(searchTerm) }, [searchTerm])

  useEffect(() => {
    let active = true
    setLoading(true)
    api.transactions({ limit: 200, search: searchTerm || undefined })
      .then((data) => {
        if (!active) return
        setItems(data.items || [])
        setError('')
      })
      .catch((e) => {
        if (!active) return
        setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [searchTerm])

  const filtered = useMemo(() => {
    const now = Date.now()
    return items.filter((item) => {
      const transaction = item.transaction || item
      const matchSearch = !search || [transaction.transaction_id, transaction.user_id, transaction.location_name].some((v) => String(v || '').toLowerCase().includes(search.toLowerCase()))
      const riskOk = risk === 'ALL' || (item.flag?.risk_level || 'LOW') === risk
      const statusOk = status === 'ALL' || (item.flag?.review_status || 'PENDING') === status

      let dateOk = true
      if (dateFilter !== 'ALL') {
        const ts = new Date(transaction.timestamp || Date.now()).getTime()
        const cutoff = { '24H': 1, '7D': 7, '30D': 30 }[dateFilter] ?? 0
        if (cutoff) dateOk = ts >= now - cutoff * DAY_MS
      }

      return matchSearch && riskOk && statusOk && dateOk
    })
  }, [items, search, risk, status, dateFilter])

  const renderTable = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <strong>Loading transactions...</strong>
          <span>Retrieving the latest transaction activity.</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="error-state">
          <strong>Unable to load transaction data.</strong>
          <span>{error}</span>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )
    }

    if (!filtered.length) {
      return (
        <div className="empty-state">
          <strong>No transactions match the current filters.</strong>
          <span>Try broadening the search or clearing the filters.</span>
        </div>
      )
    }

    return (
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Location</th>
              <th>Risk Score</th>
              <th>Risk Level</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const transaction = item.transaction || item
              const flag = item.flag || null
              const riskLevel = flag?.risk_level || 'LOW'
              const statusValue = flag?.review_status || 'PENDING'

              return (
                <tr key={transaction.id} onClick={() => setOpenId(item.id || transaction.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(item.id || transaction.id) }}>
                  <td className="strong">{transaction.transaction_id}</td>
                  <td>{transaction.user_id}</td>
                  <td>{money(transaction.amount, transaction.currency)}</td>
                  <td>{transaction.location_name || 'Unknown location'}</td>
                  <td>
                    <div className="score-cell">
                      <span className="score-number">{flag?.risk_score ?? 0}</span>
                      <span className="score-track"><span className={`score-fill lvl-${riskLevel}`} style={{ width: `${Math.min(flag?.risk_score ?? 0, 100)}%` }} /></span>
                    </div>
                  </td>
                  <td><RiskBadge level={riskLevel} /></td>
                  <td><StatusBadge status={statusValue} /></td>
                  <td>{formatTime(transaction.timestamp)}</td>
                  <td>
                    <button className="btn btn-small btn-primary" onClick={(event) => { event.stopPropagation(); setOpenId(item.id || transaction.id) }}>
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2>Transactions</h2>
          <p className="section-subtitle">Monitor and investigate transaction activity.</p>
        </div>
      </div>

      <div className="panel table-panel">
        <div className="table-head">
          <div>
            <h3>Transaction review queue</h3>
            <p className="panel-note">{filtered.length} of {items.length || 0} visible records</p>
          </div>
        </div>

        <div className="filters">
          <input className="search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, user, or location" aria-label="Search transactions" />

          <label>
            Risk level
            <select value={risk} onChange={(e) => setRisk(e.target.value)}>
              {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All risks' : value}</option>)}
            </select>
          </label>

          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {['ALL', 'PENDING', 'REVIEWED', 'CLEARED'].map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All statuses' : value}</option>)}
            </select>
          </label>

          <label>
            Date
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              {['ALL', '24H', '7D', '30D'].map((value) => <option key={value} value={value}>{value === 'ALL' ? 'All dates' : value}</option>)}
            </select>
          </label>
        </div>

        {renderTable()}
      </div>

      {openId && <DetailModal flagId={openId} ruleTitle={ruleTitle} onClose={() => setOpenId(null)} onChanged={() => api.transactions({ limit: 200, search: searchTerm || undefined }).then((data) => setItems(data.items || [])).catch(() => {})} />}
    </section>
  )
}
