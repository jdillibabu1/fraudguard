const RULES = [
  {
    name: 'Transaction Velocity',
    description: 'Tracks rapid bursts of transactions from the same user or account in a short period.',
    triggerCondition: 'More than 5 transactions within 5 minutes from the same user (the configured limit is 5).',
    riskContribution: '30 points',
    status: 'Active',
  },
  {
    name: 'Unusual Transaction Amount',
    description: 'Flags unusually high spend relative to the account’s typical payment behavior.',
    triggerCondition: 'Amount exceeds the configured threshold or exceeds the user history multiplier.',
    riskContribution: '35 points',
    status: 'Active',
  },
  {
    name: 'Impossible Geographical Location',
    description: 'Detects impossible travel between locations within a short time window.',
    triggerCondition: 'Coordinates imply travel faster than the configured speed threshold.',
    riskContribution: '45 points',
    status: 'Active',
  },
]

export default function RulesPage() {
  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2>Rules</h2>
          <p className="section-subtitle">Review the active logic powering the fraud detection engine.</p>
        </div>
      </div>

      <div className="rule-grid">
        {RULES.map((rule) => (
          <article key={rule.name} className="rule-card">
            <div className="status-pill">{rule.status}</div>
            <h3 style={{ marginTop: 12 }}>{rule.name}</h3>
            <p className="panel-note" style={{ marginTop: 8 }}>{rule.description}</p>
            <dl>
              <div>
                <dt>Trigger condition</dt>
                <dd>{rule.triggerCondition}</dd>
              </div>
              <div>
                <dt>Risk contribution</dt>
                <dd>{rule.riskContribution}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <div className="panel">
        <h3>Extensible Rule Engine</h3>
        <p className="panel-note" style={{ marginTop: 10 }}>
          New rules can be added independently without modifying the core rule engine. The backend registry supports modular rule definitions, making the fraud logic easy to expand without degrading the review workflow.
        </p>
      </div>
    </section>
  )
}
