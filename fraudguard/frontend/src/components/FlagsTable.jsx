import { RiskBadge, StatusBadge } from './Badges'
import { formatTime, money } from '../utils/format'

export default function FlagsTable({ items, loading, error, onOpen, ruleTitle, onRetry }) {
  if (error) {
    return (
      <div className="empty error-box">
        <strong>Could not load transactions</strong>
        <span>{error}</span>
        <button className="btn" onClick={onRetry}>Try again</button>
      </div>
    )
  }
  if (loading && !items.length) return <div className="empty">Loading transactions…</div>
  if (!items.length) {
    return (
      <div className="empty">
        <strong>Nothing matches these filters</strong>
        <span>Adjust the filters, or run <code>python seed.py</code> to load demo data.</span>
      </div>
    )
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Transaction ID</th><th>User</th><th className="num">Amount</th><th>Location</th><th>Time</th>
            <th>Risk score</th><th>Risk level</th><th>Triggered rules</th><th>Status</th><th />
          </tr>
        </thead>
        <tbody>
          {items.map((f) => {
            const t = f.transaction
            return (
              <tr key={f.id} onClick={() => onOpen(f.id)} tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(f.id)}>
                <td className="strong">{t.transaction_id}</td>
                <td>{t.user_id}</td>
                <td className="num">{money(t.amount, t.currency)}</td>
                <td>{t.location_name || `${t.latitude.toFixed(2)}, ${t.longitude.toFixed(2)}`}</td>
                <td className="nowrap">{formatTime(t.timestamp)}</td>
                <td>
                  <div className="score">
                    <span className="score-num">{f.risk_score}</span>
                    <span className="score-track"><span className={`score-fill lvl-${f.risk_level}`} style={{ width: `${f.risk_score}%` }} /></span>
                  </div>
                </td>
                <td><RiskBadge level={f.risk_level} /></td>
                <td>
                  <div className="chips">
                    {f.triggered_rules.length
                      ? f.triggered_rules.map((r) => <span key={r} className="chip">{ruleTitle(r)}</span>)
                      : <span className="muted">None</span>}
                  </div>
                </td>
                <td>{f.is_flagged ? <StatusBadge status={f.review_status} /> : <span className="muted">Not flagged</span>}</td>
                <td>
                  <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); onOpen(f.id) }}>
                    {f.is_flagged && f.review_status === 'PENDING' ? 'Review' : 'View'}
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
