import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const detailCache = new Map<number, DetailActivity>()
const inFlight = new Set<number>()

interface Split {
  distance: number
  moving_time: number
  average_speed: number
  elevation_difference: number
  average_heartrate?: number
}

interface BestEffort {
  name: string
  elapsed_time: number
}

interface DetailActivity {
  id: number
  name: string
  type: string
  start_date_local: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  calories?: number
  suffer_score?: number
  description?: string
  gear?: { name: string }
  kudos_count: number
  achievement_count: number
  splits_metric?: Split[]
  best_efforts?: BestEffort[]
  average_watts?: number
  weighted_average_watts?: number
  kilojoules?: number
  map?: { summary_polyline: string; polyline?: string }
}

interface Props {
  activityId: number
  token: string
  onBack: () => void
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function pace(speedMs: number): string {
  if (!speedMs) return '—'
  const s = 1000 / speedMs
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

function decodePolyline(encoded: string): [number, number][] {
  const result: [number, number][] = []
  let i = 0, lat = 0, lng = 0
  while (i < encoded.length) {
    let b, shift = 0, n = 0
    do { b = encoded.charCodeAt(i++) - 63; n |= (b & 31) << shift; shift += 5 } while (b >= 32)
    lat += n & 1 ? ~(n >> 1) : n >> 1
    shift = 0; n = 0
    do { b = encoded.charCodeAt(i++) - 63; n |= (b & 31) << shift; shift += 5 } while (b >= 32)
    lng += n & 1 ? ~(n >> 1) : n >> 1
    result.push([lat / 1e5, lng / 1e5])
  }
  return result
}

function RouteMap({ polyline }: { polyline: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const coords = decodePolyline(polyline)
    if (!coords.length) return

    const map = L.map(ref.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    const line = L.polyline(coords, { color: '#fc4c02', weight: 4, opacity: 0.85 })
    line.addTo(map)
    L.circleMarker(coords[0], { radius: 6, color: '#4caf50', fillColor: '#4caf50', fillOpacity: 1, weight: 2 }).addTo(map)
    L.circleMarker(coords[coords.length - 1], { radius: 6, color: '#e55', fillColor: '#e55', fillOpacity: 1, weight: 2 }).addTo(map)
    map.fitBounds(line.getBounds(), { padding: [24, 24] })

    return () => { map.remove() }
  }, [polyline])

  return <div ref={ref} className="activity-map" />
}

function SplitChart({ splits, type }: { splits: Split[]; type: 'pace' | 'hr' }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const values = splits.map(s => type === 'pace' ? s.average_speed : (s.average_heartrate ?? 0))
  const max = Math.max(...values, 1)

  return (
    <div className="bar-chart">
      {splits.map((s, i) => {
        const val = values[i]
        const pct = (val / max) * 100
        const label = type === 'pace' ? `${pace(s.average_speed)} /km` : `${Math.round(s.average_heartrate!)} bpm`
        const color = type === 'pace' ? '#fc4c02' : '#e05'
        return (
          <div
            key={i}
            className="bar-col"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="bar-wrapper">
              {val > 0 && (
                <div className="bar" style={{ height: `${pct}%`, background: color }}>
                  {hovered === i && <div className="bar-tooltip">{label}</div>}
                </div>
              )}
            </div>
            <div className="bar-label">{i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function ActivityDetail({ activityId, token, onBack }: Props) {
  const [detail, setDetail] = useState<DetailActivity | null>(() => detailCache.get(activityId) ?? null)
  const [loading, setLoading] = useState(() => !detailCache.has(activityId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (detailCache.has(activityId) || inFlight.has(activityId)) return

    inFlight.add(activityId)
    setLoading(true)
    setError(null)
    fetch(`${API}/activitydetails?${activityId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        detailCache.set(activityId, data)
        setDetail(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load activity details')
        setLoading(false)
      })
      .finally(() => inFlight.delete(activityId))
  }, [activityId])

  if (loading) return (
    <div className="activity-detail skeleton-card">
      <span className="skeleton" style={{ width: 140, height: 13, display: 'block', marginBottom: 20 }} />
      <div className="detail-header">
        <span className="skeleton" style={{ width: 48, height: 11, display: 'block', marginBottom: 8 }} />
        <span className="skeleton" style={{ width: '55%', height: 22, display: 'block', marginBottom: 8 }} />
        <span className="skeleton" style={{ width: 180, height: 13, display: 'block' }} />
      </div>
      <div className="detail-hero">
        {[0, 1, 2].map((i) => (
          <div className="detail-hero-stat" key={i}>
            <span className="skeleton" style={{ width: '60%', height: 28, display: 'block', margin: '0 auto 8px' }} />
            <span className="skeleton" style={{ width: '45%', height: 11, display: 'block', margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <div className="detail-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="detail-item" key={i}>
            <span className="skeleton" style={{ width: '60%', height: 11, display: 'block', marginBottom: 8 }} />
            <span className="skeleton" style={{ width: '80%', height: 16, display: 'block' }} />
          </div>
        ))}
      </div>
    </div>
  )
  if (error || !detail) return <p className="error">{error}</p>

  const isRun = detail.type === 'Run'
  const hasHR = detail.splits_metric?.some(s => s.average_heartrate)
  const polyline = detail.map?.polyline || detail.map?.summary_polyline

  return (
    <div className="activity-detail">
      <button className="back-btn" onClick={onBack}>← Back to activities</button>

      <div className="detail-header">
        <span className="activity-type">{detail.type}</span>
        <h2 className="detail-title">{detail.name}</h2>
        <div className="detail-date">
          {new Date(detail.start_date_local).toLocaleString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      </div>

      <div className="detail-hero">
        <div className="detail-hero-stat">
          <div className="detail-hero-value">{(detail.distance / 1000).toFixed(2)}</div>
          <div className="detail-hero-label">km</div>
        </div>
        <div className="detail-hero-stat">
          <div className="detail-hero-value">{formatTime(detail.moving_time)}</div>
          <div className="detail-hero-label">moving time</div>
        </div>
        <div className="detail-hero-stat">
          {isRun ? (
            <>
              <div className="detail-hero-value">{pace(detail.average_speed)}</div>
              <div className="detail-hero-label">avg pace /km</div>
            </>
          ) : (
            <>
              <div className="detail-hero-value">{(detail.average_speed * 3.6).toFixed(1)}</div>
              <div className="detail-hero-label">avg speed km/h</div>
            </>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-item">
          <div className="detail-item-label">Elevation</div>
          <div className="detail-item-value">{detail.total_elevation_gain.toFixed(0)} m</div>
        </div>
        <div className="detail-item">
          <div className="detail-item-label">Elapsed Time</div>
          <div className="detail-item-value">{formatTime(detail.elapsed_time)}</div>
        </div>
        <div className="detail-item">
          <div className="detail-item-label">{isRun ? 'Best Pace' : 'Max Speed'}</div>
          <div className="detail-item-value">
            {isRun
              ? `${pace(detail.max_speed)} /km`
              : `${(detail.max_speed * 3.6).toFixed(1)} km/h`}
          </div>
        </div>
        {detail.average_heartrate != null && (
          <div className="detail-item">
            <div className="detail-item-label">Avg Heart Rate</div>
            <div className="detail-item-value">{Math.round(detail.average_heartrate)} bpm</div>
          </div>
        )}
        {detail.max_heartrate != null && (
          <div className="detail-item">
            <div className="detail-item-label">Max Heart Rate</div>
            <div className="detail-item-value">{detail.max_heartrate} bpm</div>
          </div>
        )}
        {detail.average_cadence != null && (
          <div className="detail-item">
            <div className="detail-item-label">Avg Cadence</div>
            <div className="detail-item-value">{Math.round(detail.average_cadence)} rpm</div>
          </div>
        )}
        {detail.calories != null && (
          <div className="detail-item">
            <div className="detail-item-label">Calories</div>
            <div className="detail-item-value">{detail.calories} kcal</div>
          </div>
        )}
        {detail.suffer_score != null && (
          <div className="detail-item">
            <div className="detail-item-label">Suffer Score</div>
            <div className="detail-item-value">{detail.suffer_score}</div>
          </div>
        )}
        {detail.average_watts != null && (
          <div className="detail-item">
            <div className="detail-item-label">Avg Power</div>
            <div className="detail-item-value">{Math.round(detail.average_watts)} W</div>
          </div>
        )}
        {detail.weighted_average_watts != null && (
          <div className="detail-item">
            <div className="detail-item-label">Weighted Power</div>
            <div className="detail-item-value">{detail.weighted_average_watts} W</div>
          </div>
        )}
        {detail.kilojoules != null && (
          <div className="detail-item">
            <div className="detail-item-label">Energy</div>
            <div className="detail-item-value">{Math.round(detail.kilojoules)} kJ</div>
          </div>
        )}
        {detail.achievement_count > 0 && (
          <div className="detail-item">
            <div className="detail-item-label">Achievements</div>
            <div className="detail-item-value">{detail.achievement_count}</div>
          </div>
        )}
        {detail.kudos_count > 0 && (
          <div className="detail-item">
            <div className="detail-item-label">Kudos</div>
            <div className="detail-item-value">{detail.kudos_count}</div>
          </div>
        )}
        {detail.gear && (
          <div className="detail-item">
            <div className="detail-item-label">Gear</div>
            <div className="detail-item-value">{detail.gear.name}</div>
          </div>
        )}
      </div>

      {polyline && (
        <div className="detail-section">
          <div className="detail-section-title">Route</div>
          <RouteMap polyline={polyline} />
        </div>
      )}

      {isRun && detail.splits_metric && detail.splits_metric.length > 0 && (
        <div className="detail-charts">
          <div className="chart-card">
            <div className="chart-title">Pace per km</div>
            <SplitChart splits={detail.splits_metric} type="pace" />
          </div>
          {hasHR && (
            <div className="chart-card">
              <div className="chart-title">Heart rate per km</div>
              <SplitChart splits={detail.splits_metric} type="hr" />
            </div>
          )}
        </div>
      )}

      {detail.description ? (
        <div className="detail-section">
          <div className="detail-section-title">Description</div>
          <div className="detail-description-text">{detail.description}</div>
        </div>
      ) : null}

      {isRun && detail.splits_metric && detail.splits_metric.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Splits</div>
          <table className="splits-table">
            <thead>
              <tr>
                <th>km</th>
                <th>Pace</th>
                <th>Elev</th>
                {hasHR && <th>HR</th>}
              </tr>
            </thead>
            <tbody>
              {detail.splits_metric.map((s, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{pace(s.average_speed)} /km</td>
                  <td>{s.elevation_difference > 0 ? '+' : ''}{s.elevation_difference.toFixed(0)} m</td>
                  {hasHR && <td>{s.average_heartrate ? Math.round(s.average_heartrate) + ' bpm' : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail.best_efforts && detail.best_efforts.length > 0 && (
        <div className="detail-section">
          <div className="detail-section-title">Best Efforts</div>
          <div className="best-efforts-list">
            {detail.best_efforts.map((e, i) => (
              <div key={i} className="best-effort-item">
                <span className="best-effort-name">{e.name}</span>
                <span className="best-effort-time">{formatTime(e.elapsed_time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
