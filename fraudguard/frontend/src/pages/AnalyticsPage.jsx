import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../services/api'
import { LEVEL_COLORS } from '../utils/format'

const axis = { fontSize: 11, fill: '#586a82' }

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.stats()
      .then((data) => { if (active) { setStats(data); setError('') } })
      .catch((e) => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const reviewData = useMemo(() => (stats?.review_breakdown || []).filter((item) => item.count > 0), [stats])

  if (loading) {
    return <section className="page-section"><div className="loading-state"><strong>Loading analytics...</strong><span>Compiling fraud and risk insights.</span></div></section>
  }

  if (error) {
    return <section className="page-section"><div className="error-state"><strong>Unable to load analytics.</strong><span>{error}</span><button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button></div></section>
  }

  if (!stats) {
    return <section className="page-section"><div className="empty-state"><strong>No analytics data available.</strong><span>The backend is not returning summary metrics.</span></div></section>
  }

  return (
    <section className="page-section">
      <div className="section-header">
        <div>
          <h2>Analytics</h2>
          <p className="section-subtitle">Track risk portfolio performance, review throughput, and rule activity.</p>
        </div>
      </div>

      <div className="chart-grid">
        <div className="panel chart-panel">
          <h3>Risk Distribution</h3>
          <p className="panel-note">Current review volume by risk class.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.risk_distribution} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e3eaf5" />
                <XAxis dataKey="level" tick={axis} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stats.risk_distribution.map((entry) => <Cell key={entry.level} fill={LEVEL_COLORS[entry.level]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-panel">
          <h3>Fraud Rule Activity</h3>
          <p className="panel-note">Triggered rules across live fraud reviews.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.triggered_rules} layout="vertical" margin={{ top: 10, right: 20, left: 4, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="#e3eaf5" />
                <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="rule" width={130} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2d5bd0" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-panel large">
          <h3>Transaction Volume</h3>
          <p className="panel-note">Total transactions and flagged activity over time.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.transactions_over_time} margin={{ top: 12, right: 14, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e3eaf5" />
                <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} tickFormatter={(value) => value.slice(5)} />
                <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="transactions" fill="#132236" radius={[4, 4, 0, 0]} />
                <Bar dataKey="flagged" fill="#c33d3d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel chart-panel">
          <h3>Review Status</h3>
          <p className="panel-note">Current disposition of flagged transactions.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={reviewData} dataKey="count" nameKey="status" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  {reviewData.map((entry) => <Cell key={entry.status} fill={entry.status === 'PENDING' ? '#7b93b8' : entry.status === 'REVIEWED' ? '#2d5bd0' : '#0f8f8b'} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
