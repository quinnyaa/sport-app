import { useState } from 'react'
import BarChart, { type BarDatum } from './BarChart'
import IncompleteDataNotice from './IncompleteDataNotice'
import type { Activity } from '../lib/types'
import { MONTH_NAMES, buildYearOptions, oldestDate } from '../lib/dates'
import { SPORT_COLORS } from '../lib/colors'

interface Props {
  athleteName: string
  activities: Activity[]
  loading: boolean
  hasMore: boolean
  fetchingForDates: boolean
  onFetchForDates: (after: number, before: number) => void
  isRangeLoaded: (start: Date, end: Date) => boolean
}

function getLast14Days(activities: Activity[], type: 'Run' | 'Ride'): BarDatum[] {
  return Array.from({ length: 14 }, (_, i) => {
    const day = new Date()
    day.setDate(day.getDate() - (13 - i))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)

    const dayKm = activities
      .filter(a => a.type === type)
      .filter(a => {
        const d = new Date(a.start_date_local)
        return d >= day && d < next
      })
      .reduce((sum, a) => sum + a.distance / 1000, 0)

    return { label: String(day.getDate()), tooltip: `${dayKm.toFixed(1)} km`, value: dayKm }
  })
}

export default function Dashboard({
  athleteName,
  activities,
  loading,
  hasMore,
  fetchingForDates,
  onFetchForDates,
  isRangeLoaded,
}: Props) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const filtered = activities.filter((a) => {
    const d = new Date(a.start_date_local)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  })

  const runs = filtered.filter((a) => a.type === 'Run')
  const rides = filtered.filter((a) => a.type === 'Ride')
  const runDistance = runs.reduce((sum, a) => sum + a.distance, 0)
  const rideDistance = rides.reduce((sum, a) => sum + a.distance, 0)
  const totalTime = filtered.reduce((sum, a) => sum + a.moving_time, 0)

  const monthName = MONTH_NAMES[selectedMonth]
  const yearOptions = buildYearOptions()

  const runDays = getLast14Days(activities, 'Run')
  const rideDays = getLast14Days(activities, 'Ride')

  // Чи можуть цифри за вибраний місяць бути неповними: у Strava ще є
  // незавантажені сторінки, а найстаріша завантажена активність — пізніше
  // за початок місяця, і цей період ще не довантажували явно.
  const periodStart = new Date(selectedYear, selectedMonth, 1)
  const periodEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59)
  const oldest = oldestDate(activities)
  const dataMayBeIncomplete =
    hasMore && oldest !== null && oldest > periodStart && !isRangeLoaded(periodStart, periodEnd)

  if (loading && activities.length === 0) {
    return (
      <div>
        <div className="dashboard-heading-row">
          <h2>Welcome{athleteName ? `, ${athleteName}` : ''}</h2>
          <div className="dashboard-period-selectors">
            <span className="skeleton" style={{ width: 90, height: 32, borderRadius: 6 }} />
            <span className="skeleton" style={{ width: 72, height: 32, borderRadius: 6 }} />
          </div>
        </div>
        <div className="stats-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="stat-card skeleton-card" key={i}>
              <span className="skeleton" style={{ width: '55%', height: 28, display: 'block', margin: '0 auto 10px' }} />
              <span className="skeleton" style={{ width: '70%', height: 11, display: 'block', margin: '0 auto' }} />
            </div>
          ))}
        </div>
        <div className="charts-grid">
          {[0, 1].map((i) => (
            <div className="chart-card skeleton-card" key={i}>
              <span className="skeleton" style={{ width: '50%', height: 11, display: 'block', marginBottom: 14 }} />
              <span className="skeleton" style={{ width: '100%', height: 80, display: 'block', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="dashboard-heading-row">
        <h2>Welcome{athleteName ? `, ${athleteName}` : ''}</h2>
        <div className="dashboard-period-selectors">
          <div className="select-wrapper">
            <select
              className="dashboard-period-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="select-wrapper">
            <select
              className="dashboard-period-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {dataMayBeIncomplete && oldest && (
        <IncompleteDataNotice
          periodLabel={`${monthName} ${selectedYear}`}
          oldestLoaded={oldest}
          loading={fetchingForDates}
          onLoad={() =>
            onFetchForDates(
              Math.floor(periodStart.getTime() / 1000),
              Math.floor(periodEnd.getTime() / 1000)
            )
          }
        />
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{filtered.length}</div>
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
          <BarChart data={runDays} color={SPORT_COLORS.Run} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Ride — last 14 days</div>
          <BarChart data={rideDays} color={SPORT_COLORS.Ride} />
        </div>
      </div>
    </div>
  )
}
