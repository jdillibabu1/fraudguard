import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { RiskBadge, StatusBadge } from './Badges'
import NotificationStatus from './NotificationStatus'
import { formatFull, money } from '../utils/format'
import { useToast } from '../hooks/useToasts'

export function RuleVerdicts({ results, ruleTitle }) {
  return (
    <ul className="verdicts">
      {results.map((r) => (
        <li key={r.rule_name} className={r.triggered ? 'hit' : 'miss'}>
          <span className="mark" aria-hidden="true">{r.triggered ? '✓' : '✗'}</span>
          <div className="verdict-body">
            <div className="verdict-title">
              {ruleTitle(r.rule_name)}
              <span className="verdict-state">{r.triggered ? 'Triggered' : 'Not triggered'}</span>
              {r.triggered && <span className="verdict-score">+{r.score}</span>}
            </div>
            <div className="verdict-text">{r.triggered ? r.explanation : `No violation – ${r.explanation.charAt(0).toLowerCase()}${r.explanation.slice(1)}`}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function DetailModal({ flagId, onClose, onChanged, ruleTitle }) {
  const toast = useToast()
  const [flag, setFlag] = useState(null)
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [reviewer, setReviewer] = useState('analyst.demo')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.flag(flagId).then((f) => { setFlag(f); setComment(f.review_comment || '') }).catch((e) => setError(e.message))
  }, [flagId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (status) => {
    setSaving(true)
    try {
      const updated = await api.review(flagId, { status, reviewed_by: reviewer.trim() || 'reviewer', comment: comment.trim() || null })
      setFlag(updated)
      onChanged?.(updated)
      toast(status === 'CLEARED' ? 'Transaction cleared.' : 'Transaction marked as reviewed.')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const t = flag?.transaction
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Transaction details">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        {error && <div className="empty error-box"><strong>Could not load details</strong><span>{error}</span></div>}
        {!flag && !error && <div className="empty">Loading…</div>}
        {flag && (
          <>
            <header className="modal-head">
              <div>
                <div className="eyebrow-less">{t.transaction_id}</div>
                <h2>{money(t.amount, t.currency)} <span className="at">at {t.merchant || 'Unknown merchant'}</span></h2>
              </div>
              <div className="head-badges"><RiskBadge level={flag.risk_level} />{flag.is_flagged && <StatusBadge status={flag.review_status} />}</div>
            </header>

            <div className="score-hero">
              <div className="score-big">{flag.risk_score}<small>/100</small></div>
              <div className="score-meter">
                <div className="meter-track">
                  <div className={`meter-fill lvl-${flag.risk_level}`} style={{ width: `${flag.risk_score}%` }} />
                </div>
                <div className="meter-scale"><span>Low</span><span>Medium 30</span><span>High 60</span><span>Critical 80</span></div>
              </div>
            </div>

            <NotificationStatus
              sent={flag.notification_sent}
              channel={flag.notification_channel}
              detail={[
                flag.notification_detail,
                flag.notified_at && formatFull(flag.notified_at),
              ].filter(Boolean).join(' · ')}
            />

            <dl className="facts">
              <div><dt>User</dt><dd>{t.user_id}</dd></div>
              <div><dt>Merchant</dt><dd>{t.merchant || '—'}</dd></div>
              <div><dt>Time</dt><dd>{formatFull(t.timestamp)}</dd></div>
              <div><dt>Location</dt><dd>{t.location_name || '—'} <span className="muted">({t.latitude.toFixed(4)}, {t.longitude.toFixed(4)})</span></dd></div>
            </dl>

            <h3 className="section-title">Why was this transaction flagged?</h3>
            <RuleVerdicts results={flag.rule_results} ruleTitle={ruleTitle} />

            <h3 className="section-title">Reviewer decision</h3>
            <div className="review-form">
              <label>Reviewer
                <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={120} />
              </label>
              <label>Comment
                <textarea rows={3} value={comment} maxLength={1000} placeholder="What did you find? e.g. Customer confirmed by phone."
                          onChange={(e) => setComment(e.target.value)} />
              </label>
              <div className="actions">
                <button className="btn btn-blue" disabled={saving} onClick={() => submit('REVIEWED')}>Mark as reviewed</button>
                <button className="btn btn-teal" disabled={saving} onClick={() => submit('CLEARED')}>Clear transaction</button>
                {flag.review_status !== 'PENDING' && (
                  <button className="btn btn-ghost" disabled={saving} onClick={() => submit('PENDING')}>Reopen</button>
                )}
              </div>
            </div>

            {flag.reviews.length > 0 && (
              <div className="history">
                <h4>Review history</h4>
                <ul>
                  {[...flag.reviews].reverse().map((r) => (
                    <li key={r.id}><StatusBadge status={r.status} /> <strong>{r.reviewed_by}</strong> · {formatFull(r.reviewed_at)}
                      {r.comment && <div className="muted">{r.comment}</div>}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
