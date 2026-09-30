const AWS_CHANNELS = new Set(['sns', 'ses'])

export default function NotificationStatus({ sent, channel, detail }) {
  if (!sent) {
    return (
      <div className="notification-status notification-not-triggered" role="status">
        <strong>No high-risk notification was recorded</strong>
        <span>The backend did not record a high-risk notification for this evaluation.</span>
      </div>
    )
  }

  const providers = String(channel || '')
    .split('+')
    .filter((value) => AWS_CHANNELS.has(value.toLowerCase()))
    .map((value) => value.toUpperCase())

  if (providers.length) {
    return (
      <div className="notification-status notice-box" role="status">
        <strong>AWS notification accepted by {providers.join(' and ')}</strong>
        <span>{detail || 'The AWS service accepted the notification request.'}</span>
      </div>
    )
  }

  return (
    <div className="notification-status notice" role="status">
      <strong>Local console alert — not sent to AWS</strong>
      <span>{detail || 'The alert was recorded locally; external delivery is not confirmed.'}</span>
    </div>
  )
}