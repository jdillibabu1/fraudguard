const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export const money = (amount, currency = 'INR') =>
  `${SYMBOLS[currency] ?? currency + ' '}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

// The API returns naive UTC timestamps; add Z so the browser converts to local time.
export const parseUtc = (s) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z')

export const formatTime = (s) =>
  parseUtc(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const formatFull = (s) =>
  parseUtc(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })

export const prettify = (name) =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const LEVEL_COLORS = { LOW: '#2f8f5b', MEDIUM: '#c48a00', HIGH: '#d9622b', CRITICAL: '#c1272d' }
export const STATUS_COLORS = { PENDING: '#8a94a6', REVIEWED: '#2d5bd0', CLEARED: '#0e7c7b' }

export const LOCATIONS = [
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
  { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
]
