const ITEMS = [
  ['total_transactions', 'Total transactions', ''],
  ['flagged_transactions', 'Flagged transactions', 'warn'],
  ['high_risk', 'High risk', 'high'],
  ['critical_risk', 'Critical risk', 'crit'],
  ['pending_reviews', 'Pending reviews', 'pending'],
]

export default function StatStrip({ stats, loading }) {
  const cards = [
    { key: 'total_transactions', label: 'Total Transactions', tone: 'total', meta: 'Across monitored activity' },
    { key: 'flagged_transactions', label: 'Flagged Transactions', tone: 'flagged', meta: 'Needing review' },
    { key: 'high_risk', label: 'High Risk', tone: 'high', meta: 'Elevated exposure' },
    { key: 'critical_risk', label: 'Critical Risk', tone: 'critical', meta: 'Immediate attention' },
    { key: 'pending_reviews', label: 'Pending Reviews', tone: 'pending', meta: 'Awaiting action' },
  ]

  return (
    <section className="stat-grid" aria-label="Key numbers">
      {cards.map(({ key, label, tone, meta }) => (
        <article key={key} className={`metric-card ${tone}`}>
          <div className="metric-top">
            <span className="metric-label">{label}</span>
            <span className="metric-icon" aria-hidden="true">•</span>
          </div>
          <div className="metric-value">{loading && !stats ? '–' : stats?.[key] ?? 0}</div>
          <div className="metric-meta">{meta}</div>
        </article>
      ))}
    </section>
  )
}
