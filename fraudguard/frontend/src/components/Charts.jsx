import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { LEVEL_COLORS, STATUS_COLORS, prettify } from '../utils/format'

const axis = { fontSize: 12, fill: '#5b6779' }

function Panel({ title, note, children, empty }) {
  return (
    <div className="panel chart-panel">
      <h3>{title}</h3>
      {note && <p className="panel-note">{note}</p>}
      <div className="chart-box">{empty ? <div className="empty small">No data yet</div> : children}</div>
    </div>
  )
}

export default function Charts({ stats }) {
  if (!stats) return <div className="chart-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="panel chart-panel skeleton" />)}</div>

  const rules = stats.triggered_rules.map((r) => ({ ...r, label: prettify(r.rule) }))
  const review = stats.review_breakdown.filter((r) => r.count > 0)

  return (
    <div className="chart-grid">
      <Panel title="Risk distribution" note="All evaluated transactions by risk level">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.risk_distribution} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4e9f0" />
            <XAxis dataKey="level" tick={axis} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: '#f1f4f8' }} />
            <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]}>
              {stats.risk_distribution.map((d) => <Cell key={d.level} fill={LEVEL_COLORS[d.level]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Transactions over time" note="Per day, with how many were flagged" empty={!stats.transactions_over_time.length}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.transactions_over_time} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4e9f0" />
            <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} tickFormatter={(d) => d.slice(5)} />
            <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="transactions" name="Transactions" stroke="#0f1b2d" fill="#0f1b2d" fillOpacity={0.1} strokeWidth={2} />
            <Area type="monotone" dataKey="flagged" name="Flagged" stroke="#c1272d" fill="#c1272d" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Triggered rules" note="How often each rule fired on flagged transactions" empty={!rules.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rules} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e4e9f0" />
            <XAxis type="number" allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={130} tick={axis} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: '#f1f4f8' }} />
            <Bar dataKey="count" name="Times triggered" fill="#0e7c7b" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Flagged vs cleared" note="Review outcome of flagged transactions" empty={!review.length}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={review} dataKey="count" nameKey="status" innerRadius={52} outerRadius={82} paddingAngle={2}>
              {review.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status]} />)}
            </Pie>
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}
