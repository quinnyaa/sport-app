import { useState } from 'react'

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
  onLoadMore: () => void
  onSelectActivity: (id: number) => void
}

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

export default function Activities({ activities, loading, loadingMore, error, hasMore, onLoadMore, onSelectActivity }: Props) {
  const [page, setPage] = useState(1)

  if (loading) {
    return (
      <div>
        <h2>My Activities</h2>
        <div className="activities-list">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (error) return <p className="error">{error}</p>

  const totalPages = Math.ceil(activities.length / PER_PAGE)
  const start = (page - 1) * PER_PAGE
  const visible = activities.slice(start, start + PER_PAGE)

  function handleNext() {
    const nextPage = page + 1
    if (nextPage > totalPages && hasMore) onLoadMore()
    setPage(nextPage)
  }

  const isLastLoaded = page === totalPages
  const canGoNext = !isLastLoaded || (isLastLoaded && hasMore)

  return (
    <div>
      <h2>My Activities</h2>
      <div className="activities-list">
        {visible.map((a) => (
          <div key={a.id} className="activity-card">
            <div className="activity-header">
              <span className="activity-type">{a.type}</span>
              <span className="activity-date">
                {new Date(a.start_date_local).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div className="activity-name">{a.name}</div>
            <div className="activity-card-footer">
              <div className="activity-stats">
                <span>{formatDistance(a.distance)}</span>
                <span>{formatTime(a.moving_time)}</span>
              </div>
              <button className="details-btn" onClick={() => onSelectActivity(a.id)}>
                Check details →
              </button>
            </div>
          </div>
        ))}
      </div>

      {loadingMore && <LoadingMoreBar />}

      <div className="pagination">
        <button
          className="page-btn"
          onClick={() => setPage((p) => p - 1)}
          disabled={page === 1}
        >
          ← Prev
        </button>
        <span className="page-info">Page {page}</span>
        <button
          className="page-btn"
          onClick={handleNext}
          disabled={!canGoNext || loadingMore}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
