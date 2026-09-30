const THRESHOLDS = [
  ['Medium threshold', '30'],
  ['High threshold', '60'],
  ['Critical threshold', '80'],
  ['Flag threshold', '30'],
  ['Notification threshold', '60'],
  ['Max travel speed', '900 km/h'],
  ['Minimum travel distance', '50 km'],
]

const notifications = [
  ['Notification backend', 'auto'],
  ['AWS region', 'ap-south-1'],
  ['Email from', 'Hidden — configured on backend'],
  ['SNS topic', 'Hidden — configured on backend'],
]

export default function SettingsPage() {
  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2>Settings</h2>
          <p className="section-subtitle">Review operational thresholds and safe, non-sensitive system configuration.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="set-card">
          <h3>Risk Thresholds</h3>
          <ul className="set-list">
            {THRESHOLDS.map(([label, value]) => (
              <li key={label}><span>{label}</span><strong>{value}</strong></li>
            ))}
          </ul>
        </div>

        <div className="set-card">
          <h3>Notification Settings</h3>
          <ul className="set-list">
            {notifications.map(([label, value]) => (
              <li key={label}><span>{label}</span><strong>{value}</strong></li>
            ))}
          </ul>
        </div>

        <div className="set-card">
          <h3>System Information</h3>
          <ul className="set-list">
            <li><span>Data source</span><strong>SQLite</strong></li>
            <li><span>Engine</span><strong>Rule-based evaluation</strong></li>
            <li><span>Environment</span><strong>Local demo</strong></li>
            <li><span>Secrets</span><strong>Not exposed</strong></li>
          </ul>
        </div>
      </div>
    </section>
  )
}
