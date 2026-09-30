import { useEffect, useState } from 'react'
import { api } from './services/api'
import { useRules } from './hooks/useRules'
import ConsolePage from './pages/ConsolePage'
import SimulatorPage from './pages/SimulatorPage'
import TransactionsPage from './pages/TransactionsPage'
import FraudAlertsPage from './pages/FraudAlertsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import RulesPage from './pages/RulesPage'
import SettingsPage from './pages/SettingsPage'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'transactions', label: 'Transactions', icon: 'transactions' },
  { id: 'alerts', label: 'Fraud Alerts', icon: 'alerts' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'simulator', label: 'Simulator', icon: 'simulator' },
  { id: 'rules', label: 'Rules', icon: 'rules' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

const PAGE_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Monitor transaction activity, fraud risk, and review operations.' },
  transactions: { title: 'Transactions', subtitle: 'Monitor and investigate transaction activity.' },
  alerts: { title: 'Fraud Alerts', subtitle: 'Investigate transactions requiring reviewer attention.' },
  analytics: { title: 'Analytics', subtitle: 'Track risk trends, reviews, and rule activity across the portfolio.' },
  simulator: { title: 'Fraud Detection Simulator', subtitle: 'Test the fraud engine using realistic transaction scenarios.' },
  rules: { title: 'Rules', subtitle: 'Review the active fraud logic and risk contributions.' },
  settings: { title: 'Settings', subtitle: 'Operational thresholds and notification settings.' },
}

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

  switch (name) {
    case 'dashboard':
      return <svg {...common}><path d="M4 13.5h6V20H4zm10-10h6V20h-6zm-10-3h6v6H4zm10 8h6v6h-6z" /></svg>
    case 'transactions':
      return <svg {...common}><path d="M4 7.5h16M4 12h10m-10 4.5h16" /><path d="M16 4.5v15" /></svg>
    case 'alerts':
      return <svg {...common}><path d="M12 3.5 4.5 17h15L12 3.5Z" /><path d="M12 8.5v4.2M12 16.3h.01" /></svg>
    case 'analytics':
      return <svg {...common}><path d="M5 18.5V9.8M12 18.5V5.5M19 18.5V12.5" /><path d="M3.5 18.5h17" /></svg>
    case 'simulator':
      return <svg {...common}><path d="M4 17.5V10l4-4 4 4 6-7 2 2v12.5H4Z" /><path d="M7 14.5h2M14 14.5h3" /></svg>
    case 'rules':
      return <svg {...common}><path d="M8 4.5h8l3 3v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" /><path d="M13 4.5v4h4" /><path d="M9.5 12h5M9.5 15h5" /></svg>
    case 'settings':
      return <svg {...common}><path d="M10.5 4.5h3l.7 2.1a6.3 6.3 0 0 1 2 1.1l2.1-.8 2.1 2.1-.8 2.1a6.3 6.3 0 0 1 1.1 2l2.1.7v3l-2.1.7a6.3 6.3 0 0 1-1.1 2l.8 2.1-2.1 2.1-2.1-.8a6.3 6.3 0 0 1-2 1.1l-.7 2.1h-3l-.7-2.1a6.3 6.3 0 0 1-2-1.1l-2.1.8-2.1-2.1.8-2.1a6.3 6.3 0 0 1-1.1-2l-2.1-.7v-3l2.1-.7a6.3 6.3 0 0 1 1.1-2l-.8-2.1 2.1-2.1 2.1.8a6.3 6.3 0 0 1 2-1.1l.7-2.1Z" /><circle cx="12" cy="12" r="3.2" /></svg>
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="5.5" /><path d="m16 16 4 4" /></svg>
    case 'bell':
      return <svg {...common}><path d="M15 18.5H9" /><path d="M18 17.5H6l1.4-1.8V10a4.6 4.6 0 1 1 9.2 0v5.7L18 17.5Z" /></svg>
    case 'help':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.7 2.7 0 1 1 4.5 2.1c-.9.8-1.7 1.2-1.7 2.8" /><path d="M12 17.2h.01" /></svg>
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 18.5c1.2-2.5 3.4-3.8 7-3.8s5.8 1.3 7 3.8" /></svg>
    default:
      return null
  }
}

function ShieldMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 4 7v9c0 7 5 12 12 14 7-2 12-7 12-14V7z" fill="rgba(88, 165, 255, 0.2)" stroke="currentColor" strokeWidth="2" />
      <path d="m10 16.5 4 4 8-8" stroke="currentColor" strokeWidth="2.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [online, setOnline] = useState(null)
  const [search, setSearch] = useState('')
  const ruleTitle = useRules()

  useEffect(() => {
    const check = () => api.health().then(() => setOnline(true)).catch(() => setOnline(false))
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [])

  const meta = PAGE_META[page] ?? PAGE_META.dashboard
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <ConsolePage ruleTitle={ruleTitle} refreshKey={refreshKey} />
      case 'transactions':
        return <TransactionsPage searchTerm={search} ruleTitle={ruleTitle} />
      case 'alerts':
        return <FraudAlertsPage ruleTitle={ruleTitle} />
      case 'analytics':
        return <AnalyticsPage />
      case 'simulator':
        return <SimulatorPage ruleTitle={ruleTitle} onCreated={() => setRefreshKey((k) => k + 1)} goToConsole={() => setPage('dashboard')} />
      case 'rules':
        return <RulesPage />
      case 'settings':
        return <SettingsPage />
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Sidebar navigation">
        <div className="brand-block">
          <div className="brand-mark"><ShieldMark /></div>
          <div>
            <div className="brand-name">FRAUDGUARD</div>
            <div className="brand-subtitle">Fraud Risk &amp; Review Console</div>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-box">
            <div className="label-small">System Status</div>
            <div className="status-row"><span className="status-dot" aria-hidden="true" /><span>All systems operational</span></div>
          </div>

          <div className="user-box">
            <div className="user-avatar"><Icon name="user" /></div>
            <div>
              <div className="user-name">Reviewer</div>
              <div className="user-role">Fraud Operations</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div className="page-heading">
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
            {page === 'dashboard' && <span className="today-pill">{todayLabel}</span>}
          </div>

          <div className="topbar-actions">
            <label className="search-box" aria-label="Search transactions">
              <span className="search-icon"><Icon name="search" /></span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." />
            </label>

            <button className="topbar-icon" aria-label="Notifications" title="Open fraud alerts" onClick={() => setPage('alerts')}><Icon name="bell" /></button>
            <a className="topbar-icon" aria-label="Help" title="Open API documentation" href="http://localhost:8000/docs" target="_blank" rel="noreferrer"><Icon name="help" /></a>

            <div className="api-pill" aria-live="polite">
              <span className={`api-dot ${online === false ? 'offline' : online ? 'online' : ''}`} />
              {online === false ? 'Offline' : online ? 'Connected' : 'Checking'}
            </div>

            <div className="profile-box">
              <div className="mini-avatar">R</div>
              <div>
                <div className="profile-name">Reviewer</div>
                <div className="profile-role">Fraud Operations</div>
              </div>
            </div>
          </div>
        </header>

        <main className="page-body">{renderPage()}</main>
      </div>
    </div>
  )
}
