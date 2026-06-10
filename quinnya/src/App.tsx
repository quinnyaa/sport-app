import { useEffect, useState } from 'react'
import './App.css'
const quinnYaIcon = '/quinnya_icon.svg'
import Dashboard from './components/Dashboard'
import Activities from './components/Activities'
import ActivityDetail from './components/ActivityDetail'
import Progress from './components/Progress'
import Goals from './components/Goals'

type Tab = 'dashboard' | 'activities' | 'progress' | 'goals'
type Theme = 'light' | 'dark'

interface Activity {
  id: number
  name: string
  type: string
  distance: number
  moving_time: number
  start_date_local: string
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'activities', label: 'Activities' },
  { id: 'progress', label: 'Progress' },
  { id: 'goals', label: 'Goals' },
]

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function App() {
  const [authChecked, setAuthChecked] = useState(false)
  // Світла тема — за замовчуванням; вибір зберігається в localStorage
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('quinnya_theme') === 'dark' ? 'dark' : 'light'
  )
  const [token, setToken] = useState<string | null>(null)
  const [athleteName, setAthleteName] = useState<string>(() => localStorage.getItem('athlete_name') ?? '')
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('activitydetails')) return 'activities'
    return (localStorage.getItem('active_tab') as Tab) ?? 'dashboard'
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [stravaPage, setStravaPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [fetchingForDates, setFetchingForDates] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('activitydetails')
    if (fromUrl) return Number(fromUrl)
    const saved = sessionStorage.getItem('selected_activity_id')
    return saved ? Number(saved) : null
  })

  function selectActivity(id: number | null) {
    setSelectedActivityId(id)
    if (id === null) {
      sessionStorage.removeItem('selected_activity_id')
      window.history.pushState({}, '', '/')
    } else {
      sessionStorage.setItem('selected_activity_id', String(id))
      window.history.pushState({}, '', `?activitydetails=${id}`)
    }
  }

  // Перемикання вкладки: скидаємо відкриту активність і чистимо URL,
  // щоб ?activitydetails= не «зависало» в адресі при переході в інший розділ.
  function changeTab(tab: Tab) {
    setActiveTab(tab)
    localStorage.setItem('active_tab', tab)
    if (selectedActivityId !== null) {
      setSelectedActivityId(null)
      sessionStorage.removeItem('selected_activity_id')
      window.history.pushState({}, '', '/')
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('quinnya_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')

    if (sessionId) {
      window.history.replaceState({}, '', '/')
      fetch(`${API}/auth/token?session_id=${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          localStorage.setItem('quinnya_session', data.session_token)
          setToken(data.session_token)
          if (data.athlete_name) {
            localStorage.setItem('athlete_name', data.athlete_name)
            setAthleteName(data.athlete_name)
          }
        })
        .catch(() => setError('Auth failed, please try again'))
        .finally(() => setAuthChecked(true))
    } else {
      const saved = localStorage.getItem('quinnya_session')
      if (saved) setToken(saved)
      setAuthChecked(true)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    loadFromCache(token)
  }, [token])

  function handleUnauthorized() {
    localStorage.removeItem('quinnya_session')
    localStorage.removeItem('athlete_name')
    setToken(null)
    setAthleteName('')
    setActivities([])
    setStravaPage(1)
    setHasMore(true)
  }

  async function loadFromCache(t: string) {
    setLoading(true)
    try {
      const res = await fetch(`${API}/activities/cached`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.status === 401) { handleUnauthorized(); return }
      const data: Activity[] = await res.json()

      if (Array.isArray(data) && data.length > 0) {
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
      const res = await fetch(`${API}/activities?page=${page}`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.status === 401) { handleUnauthorized(); return }
      const data: Activity[] = await res.json()

      if (!Array.isArray(data)) { setError('Unexpected response from server'); return }
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

  async function fetchForDates(after: number, before: number) {
    if (!token) return
    setFetchingForDates(true)
    try {
      const res = await fetch(
        `${API}/activities?after=${after}&before=${before}&per_page=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (res.status === 401) { handleUnauthorized(); return }
      const data: Activity[] = await res.json()
      if (!Array.isArray(data)) { setError('Unexpected response from server'); return }
      setActivities((prev) => {
        const ids = new Set(prev.map((a) => a.id))
        const merged = [...prev, ...data.filter((a) => !ids.has(a.id))]
        return merged.sort(
          (a, b) =>
            new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()
        )
      })
    } catch {
      setError('Failed to load activities for selected period')
    } finally {
      setFetchingForDates(false)
    }
  }

  async function syncActivities() {
    if (!token || syncing) return
    setSyncing(true)
    try {
      const syncRes = await fetch(`${API}/activities?page=1`, { headers: { Authorization: `Bearer ${token}` } })
      if (syncRes.status === 401) { handleUnauthorized(); return }
      const res = await fetch(`${API}/activities/cached`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { handleUnauthorized(); return }
      const data: Activity[] = await res.json()
      if (Array.isArray(data) && data.length > 0) setActivities(data)
    } catch {
      setError('Failed to sync activities')
    } finally {
      setSyncing(false)
    }
  }

  function logout() {
    if (token) {
      fetch(`${API}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    localStorage.removeItem('quinnya_session')
    localStorage.removeItem('athlete_name')
    setToken(null)
    setAthleteName('')
    setActivities([])
    setStravaPage(1)
    setHasMore(true)
  }

  if (!authChecked) return null

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
        <div
          className="header-logo"
          onClick={() => changeTab('dashboard')}
          style={{ cursor: 'pointer' }}
        >
          <img src={quinnYaIcon} alt="Quinnya" className="app-icon" />
          <h1>QUINNYA</h1>
          <span className="app-version">v{__APP_VERSION__}</span>
        </div>
        <div className="header-actions">
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
          <button onClick={syncActivities} className="sync-btn" disabled={syncing}>
            {syncing ? 'Syncing…' : '↻ Sync'}
          </button>
          <button onClick={logout} className="logout-btn">Log out</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => changeTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'dashboard' && (
          <Dashboard athleteName={athleteName} activities={activities} loading={loading} />
        )}
        {activeTab === 'activities' && selectedActivityId !== null && (
          <ActivityDetail
            activityId={selectedActivityId}
            token={token!}
            onBack={() => selectActivity(null)}
            onUnauthorized={handleUnauthorized}
          />
        )}
        {activeTab === 'activities' && selectedActivityId === null && (
          <Activities
            activities={activities}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            hasMore={hasMore}
            token={token!}
            onLoadMore={loadMore}
            onSelectActivity={selectActivity}
            onFetchForDates={fetchForDates}
            fetchingForDates={fetchingForDates}
          />
        )}
        {activeTab === 'progress' && <Progress activities={activities} loading={loading} />}
        {activeTab === 'goals' && <Goals activities={activities} loading={loading} />}
      </main>
    </div>
  )
}

export default App
