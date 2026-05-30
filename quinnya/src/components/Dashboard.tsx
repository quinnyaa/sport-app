import { useState } from 'react'

interface Activity {
  id: number
  type: string
  distance: number
  moving_time: number
  start_date_local: string
}

interface Props {
  athleteName: string
  activities: Activity[]
}

interface DayBar {
  label: string
  km: number
}

function getLast14Days(activities: Activity[], type: 'Run' | 'Ride'): DayBar[] {
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date()
    day.setDate(day.getDate() - (13 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)

    const km = activities
      .filter(a => a.type === type)
      .filter(a => {
        const d = new Date(a.start_date_local)
        return d >= day && d < next
      })
      .reduce((sum, a) => sum + a.distance / 1000, 0)

    return { label: String(day.getDate()), km }
  })
}

function BarChart({ data, color }: { data: DayBar[]; color: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.km), 1)
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div
          key={i}
          className="bar-col"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="bar-wrapper">
            {d.km > 0 && (
              <div
                className="bar"
                style={{ height: `${(d.km / max) * 100}%`, background: color }}
              >
                {hovered === i && (
                  <div className="bar-tooltip">{d.km.toFixed(1)} km</div>
                )}
              </div>
            )}
          </div>
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ athleteName, activities }: Props) {
  const now = new Date()
  const thisMonth = activities.filter((a) => {
    const d = new Date(a.start_date_local)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const runs = thisMonth.filter((a) => a.type === 'Run')
  const rides = thisMonth.filter((a) => a.type === 'Ride')
  const runDistance = runs.reduce((sum, a) => sum + a.distance, 0)
  const rideDistance = rides.reduce((sum, a) => sum + a.distance, 0)
  const totalTime = thisMonth.reduce((sum, a) => sum + a.moving_time, 0)

  const monthName = now.toLocaleString('en-GB', { month: 'long' })

  const runDays = getLast14Days(activities, 'Run')
  const rideDays = getLast14Days(activities, 'Ride')

  return (
    <div>
      <h2>Welcome{athleteName ? `, ${athleteName}` : ''}</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{thisMonth.length}</div>
          <div className="stat-label">{monthName} Activities</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(runDistance / 1000).toFixed(0)} km</div>
          <div className="stat-label">{monthName} Runs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{(rideDistance / 1000).toFixed(0)} km</div>
          <div className="stat-label">{monthName} Rides</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{Math.floor(totalTime / 3600)} h</div>
          <div className="stat-label">{monthName} Time</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Run — last 14 days</div>
          <BarChart data={runDays} color="#fc4c02" />
        </div>
        <div className="chart-card">
          <div className="chart-title">Ride — last 14 days</div>
          <BarChart data={rideDays} color="#3b82f6" />
        </div>
      </div>
    </div>
  )
}
