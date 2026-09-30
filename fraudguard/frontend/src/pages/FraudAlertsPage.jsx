import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { RiskBadge, StatusBadge } from '../components/Badges'
import DetailModal from '../components/DetailModal'
import { money } from '../utils/format'

export default function FraudAlertsPage({ ruleTitle }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.flags({ flagged_only: true, limit: 200 })
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
  }, [])

  const summary = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0 }
    items.forEach((item) => {
      if (item.risk_level === 'CRITICAL') counts.CRITICAL += 1
      else if (item.risk_level === 'HIGH') counts.HIGH += 1
      else if (item.risk_level === 'MEDIUM') counts.MEDIUM += 1
    })
    return counts
  }, [items])

  if (loading) {
    return (
      <section className="page-section">
        <div className="loading-state"><strong>Loading fraud alerts...</strong><span>Reviewing flagged transactions.</span></div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="page-section">
        <div className="error-state"><strong>Unable to load alerts.</strong><span>{error}</span><button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button></div>
      </section>
    )
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2>Fraud Alerts</h2>
          <p className="section-subtitle">Investigate transactions requiring reviewer attention.</p>
        </div>
      </div>

      <div className="alert-grid">
        {[
          { key: 'CRITICAL', label: 'Critical', count: summary.CRITICAL, tone: 'critical' },
          { key: 'HIGH', label: 'High', count: summary.HIGH, tone: 'high' },
          { key: 'MEDIUM', label: 'Medium', count: summary.MEDIUM, tone: 'medium' },
        ].map((card) => (
          <div key={card.key} className={`alert-card ${card.tone}`}>
            <div className="alert-card-header">
              <div>
                <div className="label-small">{card.label}</div>
                <h4>{card.count}</h4>
              </div>
              <RiskBadge level={card.key} />
            </div>
            <div className="meta">
              <span>{card.label} risk queue</span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="table-head">
          <div>
            <h3>Recent high-priority alerts</h3>
            <p className="panel-note">{items.length} items requiring review</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state"><strong>No alerts currently open.</strong><span>Everything is currently within the configured thresholds.</span></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>Triggered Rules</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const transaction = item.transaction
                  return (
                    <tr key={item.id}>
                      <td className="strong">{transaction.transaction_id}</td>
                      <td>{transaction.user_id}</td>
                      <td>{money(transaction.amount, transaction.currency)}</td>
                      <td><RiskBadge level={item.risk_level} /></td>
                      <td><div className="trigger-list">{item.triggered_rules.slice(0, 2).map((rule) => <span key={rule} className="chip">{rule}</span>)}</div></td>
                      <td><StatusBadge status={item.review_status} /></td>
                      <td><button className="btn btn-small btn-primary" onClick={() => setOpenId(item.id)}>Review Now</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && <DetailModal flagId={openId} ruleTitle={ruleTitle} onClose={() => setOpenId(null)} onChanged={() => api.flags({ flagged_only: true, limit: 200 }).then((data) => setItems(data.items || [])).catch(() => {})} />}
    </section>
  )
}
