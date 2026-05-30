import { useEffect, useState } from 'react'
import './App.css'
const quinnYaIcon = '/quinnya_icon.svg'
import Dashboard from './components/Dashboard'
import Activities from './components/Activities'
import ActivityDetail from './components/ActivityDetail'
import Progress from './components/Progress'
import Goals from './components/Goals'

type Tab = 'dashboard' | 'activities' | 'progress' | 'goals'

interface Activity {
  id: number
  name: string
  type: string
  distance: number
  moving_time: number
  start_date_local: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Main' },
  { id: 'activities', label: 'Activities' },
  { id: 'progress', label: 'Progress' },
  { id: 'goals', label: 'Goals' },
]

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function App() {
  const [token, setToken] = useState<string | null>(null)
  const [athleteName, setAthleteName] = useState<string>(() => localStorage.getItem('athlete_name') ?? '')
  const [activeTab, setActiveTab] = useState<Tab>(
    () => (localStorage.getItem('active_tab') as Tab) ?? 'dashboard'
  )
  const [activities, setActivities] = useState<Activity[]>([])
  const [stravaPage, setStravaPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('access_token')

    if (urlToken) {
      localStorage.setItem('strava_token', urlToken)
      setToken(urlToken)
      const name = params.get('athlete_name') ?? ''
      if (name) {
        localStorage.setItem('athlete_name', name)
        setAthleteName(name)
      }
      window.history.replaceState({}, '', '/')
    } else {
      const saved = localStorage.getItem('strava_token')
      if (saved) setToken(saved)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    loadFromCache(token)
  }, [token])

  async function loadFromCache(t: string) {
    setLoading(true)
    try {
      const res = await fetch(`${API}/activities/cached?access_token=${t}`)
      const data: Activity[] = await res.json()

      if (data.length > 0) {
        setActivities(data)
        // Розраховуємо яку сторінку Strava вже маємо в БД
        setStravaPage(Math.ceil(data.length / 30))
      } else {
        // БД порожня — перший запуск, тягнемо зі Strava
        await fetchFromStrava(t, 1, true)
        return
      }
    } catch {
      setError('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  async function fetchFromStrava(t: string, page: number, initial: boolean) {
    initial ? setLoading(true) : setLoadingMore(true)

    try {
      const res = await fetch(`${API}/activities?access_token=${t}&page=${page}`)
      const data: Activity[] = await res.json()

      if (data.length < 30) setHasMore(false)

      setActivities((prev) => initial ? data : [...prev, ...data])
      setStravaPage(page)
    } catch {
      setError('Failed to load activities')
    } finally {
      initial ? setLoading(false) : setLoadingMore(false)
    }
  }

  function loadMore() {
    if (!token || !hasMore) return
    fetchFromStrava(token, stravaPage + 1, false)
  }

  async function syncActivities() {
    if (!token || syncing) return
    setSyncing(true)
    try {
      await fetch(`${API}/activities?access_token=${token}&page=1`)
      const res = await fetch(`${API}/activities/cached?access_token=${token}`)
      const data: Activity[] = await res.json()
      if (data.length > 0) setActivities(data)
    } catch {
      setError('Failed to sync activities')
    } finally {
      setSyncing(false)
    }
  }

  function logout() {
    localStorage.removeItem('strava_token')
    localStorage.removeItem('athlete_name')
    setToken(null)
    setAthleteName('')
    setActivities([])
    setStravaPage(1)
    setHasMore(true)
  }

  if (!token) {
    return (
      <div className="auth-screen">
        <img src={quinnYaIcon} alt="Quinnya" className="auth-icon" />
        <h1>QUINNYA</h1>
        <p>Your personal sport tracker</p>
        <a href={`${API}/auth/strava`} className="strava-btn">
          Connect Strava
        </a>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <div className="header-logo">
          <img src={quinnYaIcon} alt="Quinnya" className="app-icon" />
          <h1>QUINNYA</h1>
        </div>
        <div className="header-actions">
          <button onClick={syncActivities} className="sync-btn" disabled={syncing}>
            {syncing ? 'Syncing…' : '↻ Sync'}
          </button>
          <button onClick={logout} className="logout-btn">Exit</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              localStorage.setItem('active_tab', tab.id)
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <Dashboard athleteName={athleteName} activities={activities} />
        )}
        {activeTab === 'activities' && selectedActivityId !== null && (
          <ActivityDetail
            activityId={selectedActivityId}
            token={token!}
            onBack={() => setSelectedActivityId(null)}
          />
        )}
        {activeTab === 'activities' && selectedActivityId === null && (
          <Activities
            activities={activities}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onSelectActivity={setSelectedActivityId}
          />
        )}
        {activeTab === 'progress' && <Progress />}
        {activeTab === 'goals' && <Goals activities={activities} />}
      </main>
    </div>
  )
}

export default App
