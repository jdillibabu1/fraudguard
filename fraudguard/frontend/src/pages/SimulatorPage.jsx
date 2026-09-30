import { useState } from 'react'
import { api } from '../services/api'
import { RiskBadge } from '../components/Badges'
import NotificationStatus from '../components/NotificationStatus'
import { RuleVerdicts } from '../components/DetailModal'
import { LOCATIONS, money } from '../utils/format'
import { useToast } from '../hooks/useToasts'

const USERS = ['USR-1001', 'USR-1002', 'USR-1003', 'USR-1004', 'USR-1005', 'USR-1006', 'USR-1007', 'USR-1008']
const loc = (name) => LOCATIONS.find((l) => l.name === name)
const ago = (ms) => new Date(Date.now() - ms).toISOString()

export default function SimulatorPage({ ruleTitle, onCreated, goToConsole }) {
  const toast = useToast()
  const [form, setForm] = useState({ user_id: 'USR-1002', amount: '2500', location: 'Mumbai', merchant: 'Demo Store' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const base = (l) => ({ user_id: form.user_id.trim(), latitude: l.lat, longitude: l.lon, location_name: l.name, merchant: form.merchant || null })

  // Sends a list of transactions in order and shows the last (usually highest-risk) evaluation.
  const run = async (payloads, label) => {
    setBusy(true); setError('')
    try {
      let last
      for (const p of payloads) last = await api.createTransaction(p)
      setResult({ label, txn: last, count: payloads.length })
      onCreated()
      if (last.flag.notification_sent) {
        const providers = String(last.flag.notification_channel || '').split('+').filter((value) => ['sns', 'ses'].includes(value.toLowerCase()))
        toast(providers.length
          ? `AWS notification accepted by ${providers.map((value) => value.toUpperCase()).join(' and ')}`
          : 'Alert logged locally; not sent to AWS', providers.length ? 'success' : 'warn')
      } else {
        toast(`${label}: risk ${last.flag.risk_level} (${last.flag.risk_score})`)
      }
    } catch (e) {
      setError(e.message); toast(e.message, 'error')
    } finally { setBusy(false) }
  }

  const submitManual = (e) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) { setError('Amount must be a number greater than 0'); return }
    run([{ ...base(loc(form.location)), amount, currency: 'INR' }], 'Custom transaction')
  }

  const scenarios = [
    { title: 'Rapid-fire burst', text: 'Six purchases within 3 minutes',
      go: () => run(Array.from({ length: 6 }, (_, i) => ({ ...base(loc(form.location)), amount: 900 + i * 50, timestamp: ago((5 - i) * 30000) })), 'Velocity burst') },
    { title: 'High-value purchase', text: '₹5,00,000 in a single payment',
      go: () => run([{ ...base(loc(form.location)), amount: 500000 }], 'High-value purchase') },
    { title: 'Impossible travel', text: 'Chennai, then New York 15 minutes later',
      go: () => run([
        { ...base(loc('Chennai')), amount: 3200, timestamp: ago(15 * 60000) },
        { ...base(loc('New York')), amount: 7400, timestamp: ago(0) },
      ], 'Impossible travel') },
    { title: 'All three rules', text: 'Alternating cities, rapid, high-value',
      go: () => run(Array.from({ length: 6 }, (_, i) => ({ ...base(loc(i % 2 ? 'Singapore' : 'Chennai')),
        amount: i >= 4 ? 420000 : 5000, timestamp: ago((5 - i) * 20000) })), 'Multi-rule attack') },
  ]

  return (
    <div className="sim-card-grid">
      <section className="panel">
        <h2>Simulate a transaction</h2>
        <p className="panel-note">Sent to the live API and evaluated by the same rule engine. Nothing is faked.</p>
        <form onSubmit={submitManual} className="sim-form">
          <div className="form-grid">
            <label className="full">
              <span>User ID</span>
              <input list="users" value={form.user_id} onChange={set('user_id')} required maxLength={64} />
              <datalist id="users">{USERS.map((u) => <option key={u} value={u} />)}</datalist>
            </label>

            <label>
              <span>Amount</span>
              <input type="number" min="1" step="any" value={form.amount} onChange={set('amount')} required />
            </label>

            <label>
              <span>Location</span>
              <select value={form.location} onChange={set('location')}>{LOCATIONS.map((l) => <option key={l.name}>{l.name}</option>)}</select>
            </label>

            <label className="full">
              <span>Merchant</span>
              <input value={form.merchant} onChange={set('merchant')} maxLength={120} />
            </label>
          </div>

          <button className="btn btn-primary" disabled={busy}>{busy ? 'Evaluating…' : 'Submit Transaction'}</button>
        </form>

        <h3 className="section-title">One-click attack scenarios</h3>
        <div className="scenario-grid">
          {scenarios.map((s) => (
            <button key={s.title} className="scenario-card" disabled={busy} onClick={s.go}>
              <strong>{s.title}</strong><span>{s.text}</span>
            </button>
          ))}
        </div>
        {error && <div className="banner-error">{error}</div>}
      </section>

      <section className="panel result-box">
        <h2>Evaluation result</h2>
        {!result ? (
          <div className="empty-state"><strong>No evaluation yet.</strong><span>Submit a transaction or run a scenario to see how the rule engine responds.</span></div>
        ) : (
          <>
            <p className="panel-note">{result.label}{result.count > 1 ? ` · ${result.count} transactions sent, showing the last` : ''}</p>
            <div className="result-summary">
              <div><div className="eyebrow-less">{result.txn.transaction_id}</div><strong>{money(result.txn.amount, result.txn.currency)}</strong> · {result.txn.location_name}</div>
              <div className="head-badges"><span className="score-big small">{result.txn.flag.risk_score}<small>/100</small></span><RiskBadge level={result.txn.flag.risk_level} /></div>
            </div>
            <NotificationStatus
              sent={result.txn.flag.notification_sent}
              channel={result.txn.flag.notification_channel}
              detail={result.txn.flag.notification_detail}
            />
            <RuleVerdicts results={result.txn.flag.rule_results} ruleTitle={ruleTitle} />
            <button className="btn btn-primary" onClick={goToConsole}>Open in reviewer console</button>
          </>
        )}
      </section>
    </div>
  )
}
