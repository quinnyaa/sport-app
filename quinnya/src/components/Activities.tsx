import { useState, useMemo } from 'react'
import { showToast } from '../toast'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Activity {
  id: number
  name: string
  type: string
  distance: number
  moving_time: number
  start_date_local: string
}

interface Props {
  activities: Activity[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  token: string
  onLoadMore: () => void
  onSelectActivity: (id: number) => void
  onFetchForDates?: (after: number, before: number) => void
  fetchingForDates?: boolean
}

type TypeFilter = 'all' | 'Run' | 'Ride'

const PER_PAGE = 5

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2) + ' km'
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

function SkeletonCard() {
  return (
    <div className="activity-card skeleton-card">
      <div className="activity-header">
        <span className="skeleton skeleton-type" />
        <span className="skeleton skeleton-date" />
      </div>
      <div className="skeleton skeleton-name" />
      <div className="activity-stats">
        <span className="skeleton skeleton-stat" />
        <span className="skeleton skeleton-stat" />
      </div>
    </div>
  )
}

function LoadingMoreBar() {
  return (
    <div className="loading-more-bar">
      <span className="loading-more-dot" />
      <span className="loading-more-dot" />
      <span className="loading-more-dot" />
    </div>
  )
}

async function downloadGpx(activityId: number, token: string) {
  const res = await fetch(`${API}/activities/${activityId}/gpx`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const cd = res.headers.get('content-disposition')
  const match = cd?.match(/filename="(.+)"/)
  a.download = match ? match[1] : `activity_${activityId}.gpx`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Activities({
  activities,
  loading,
  loadingMore,
  error,
  hasMore,
  token,
  onLoadMore,
  onSelectActivity,
  onFetchForDates,
  fetchingForDates,
}: Props) {
  const [page, setPage] = useState(() => {
    const p = parseInt(new URLSearchParams(window.location.search).get('page') ?? '1', 10)
    return isNaN(p) || p < 1 ? 1 : p
  })
  const [downloading, setDownloading] = useState<Set<number>>(new Set())

  async function handleGpxDownload(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (downloading.has(id)) return
    setDownloading(prev => new Set(prev).add(id))
    try {
      await downloadGpx(id, token)
      showToast('GPX downloaded', 'success')
    } catch {
      showToast('Download failed', 'error')
    } finally {
      setDownloading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function savePage(p: number) {
    const params = new URLSearchParams(window.location.search)
    if (p === 1) {
      params.delete('page')
    } else {
      params.set('page', String(p))
    }
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    setPage(p)
  }
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const date = new Date(a.start_date_local)
      if (dateFrom && date < new Date(dateFrom)) return false
      if (dateTo && date > new Date(dateTo + 'T23:59:59')) return false
      if (typeFilter !== 'all' && a.type !== typeFilter) return false
      return true
    })
  }, [activities, dateFrom, dateTo, typeFilter])

  const needsOlderFetch = useMemo(() => {
    if (!dateFrom || !onFetchForDates || activities.length === 0) return false
    const oldest = activities.reduce((o, a) =>
      new Date(a.start_date_local) < new Date(o.start_date_local) ? a : o
    )
    return new Date(oldest.start_date_local) > new Date(dateFrom) && hasMore
  }, [activities, dateFrom, hasMore, onFetchForDates])

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setTypeFilter('all')
    savePage(1)
  }

  function handleDateFromChange(val: string) {
    setDateFrom(val)
    savePage(1)
  }

  function handleDateToChange(val: string) {
    setDateTo(val)
    savePage(1)
  }

  function handleTypeChange(t: TypeFilter) {
    setTypeFilter(t)
    savePage(1)
  }

  function handleLoadForDates() {
    if (!onFetchForDates || !dateFrom) return
    const after = Math.floor(new Date(dateFrom).getTime() / 1000)
    const before = dateTo
      ? Math.floor(new Date(dateTo + 'T23:59:59').getTime() / 1000)
      : Math.floor(Date.now() / 1000)
    onFetchForDates(after, before)
  }

  const hasActiveFilters = dateFrom || dateTo || typeFilter !== 'all'

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const safePageFiltered = Math.min(page, Math.max(1, totalPages))
  const start = (safePageFiltered - 1) * PER_PAGE
  const visible = filtered.slice(start, start + PER_PAGE)

  function goToPage(targetPage: number) {
    if (targetPage > totalPages && hasMore && !hasActiveFilters) onLoadMore()
    savePage(targetPage)
  }

  const canLoadMore = hasMore && !hasActiveFilters

  const prevPageButton = safePageFiltered > 1 ? safePageFiltered - 1 : null

  const nextPageButtons: number[] = []
  for (let i = 1; i <= 2; i++) {
    const p = safePageFiltered + i
    const exists = p <= totalPages
    const loadable = canLoadMore && p <= totalPages + 1
    if (exists || loadable) nextPageButtons.push(p)
  }
  const showLast = totalPages > safePageFiltered + 2

  const filterPanel = (
    <div className="activities-filters">
      <div className="filter-type-toggle">
        {(['all', 'Run', 'Ride'] as TypeFilter[]).map((t) => (
          <button
            key={t}
            className={`filter-type-btn${typeFilter === t ? ' active' : ''}`}
            onClick={() => handleTypeChange(t)}
          >
            {t === 'all' ? 'All' : t}
          </button>
        ))}
      </div>
      <div className="filter-dates">
        <label className="filter-date-label" htmlFor="filter-date-from">From</label>
        <input
          id="filter-date-from"
          type="date"
          className="filter-date-input"
          value={dateFrom}
          onChange={(e) => handleDateFromChange(e.target.value)}
          max={dateTo || undefined}
        />
        <span className="filter-date-sep">–</span>
        <label className="filter-date-label" htmlFor="filter-date-to">To</label>
        <input
          id="filter-date-to"
          type="date"
          className="filter-date-input"
          value={dateTo}
          onChange={(e) => handleDateToChange(e.target.value)}
          min={dateFrom || undefined}
        />
      </div>
      {hasActiveFilters && (
        <button className="filter-reset-btn" onClick={resetFilters}>
          Reset
        </button>
      )}
    </div>
  )

  if (loading) {
    return (
      <div>
        <div className="activities-heading-row">
          <h2>My Activities</h2>
          {filterPanel}
        </div>
        <div className="activities-list">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (error) return <p className="error">{error}</p>

  return (
    <div>
      <div className="activities-heading-row">
        <h2>My Activities</h2>
        {filterPanel}
      </div>

      {needsOlderFetch && (
        <div className="filter-fetch-banner">
          <span>No activities found before {new Date(activities[activities.length - 1]?.start_date_local).toLocaleDateString('en-GB')} — older data may not be loaded yet.</span>
          <button
            className="filter-fetch-btn"
            onClick={handleLoadForDates}
            disabled={fetchingForDates}
          >
            {fetchingForDates ? 'Loading…' : 'Load for this period'}
          </button>
        </div>
      )}

      <div className="activities-list">
        {visible.length === 0 && !loadingMore && (
          <p className="status-text" style={{ textAlign: 'center' }}>
            No activities match the selected filters.
          </p>
        )}
        {visible.map((a) => (
          <div key={a.id} className="activity-card" onClick={() => onSelectActivity(a.id)}>
            <div className="activity-header">
              <span className="activity-type">{a.type}</span>
              <span className="activity-date">
                {new Date(a.start_date_local).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div className="activity-name">{a.name}</div>
            <div className="activity-stats">
              <span>{formatDistance(a.distance)}</span>
              <span>{formatTime(a.moving_time)}</span>
              <button
                className="gpx-download-btn"
                title="Download GPX"
                disabled={downloading.has(a.id)}
                onClick={(e) => handleGpxDownload(e, a.id)}
              >
                {downloading.has(a.id) ? (
                  <svg className="gpx-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>.gpx</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {loadingMore && <LoadingMoreBar />}

      {filtered.length > 0 && (
        <div className="pagination">
          <button
            className="page-btn page-btn--arrow"
            onClick={() => savePage(safePageFiltered - 1)}
            disabled={safePageFiltered === 1}
          >
            ←
          </button>
          {prevPageButton && (
            <button className="page-btn" onClick={() => savePage(prevPageButton)}>
              {prevPageButton}
            </button>
          )}
          <span className="page-info">{safePageFiltered}</span>
          {nextPageButtons.map((p) => (
            <button
              key={p}
              className="page-btn"
              onClick={() => goToPage(p)}
              disabled={loadingMore}
            >
              {p}
            </button>
          ))}
          {showLast && (
            <>
              {totalPages > safePageFiltered + 3 && <span className="page-ellipsis">…</span>}
              <button className="page-btn" onClick={() => savePage(totalPages)}>
                {totalPages}
              </button>
            </>
          )}
          <button
            className="page-btn page-btn--arrow"
            onClick={() => goToPage(safePageFiltered + 1)}
            disabled={!(safePageFiltered < totalPages || canLoadMore) || loadingMore}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
