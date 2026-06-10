import { useMemo, useState } from 'react'
import BarChart, { type BarDatum } from './BarChart'
import IncompleteDataNotice from './IncompleteDataNotice'
import type { Activity } from '../lib/types'
import { MONTH_NAMES, MONTH_LABELS, weekStart, oldestDate } from '../lib/dates'
import { SPORT_COLORS, sportColor } from '../lib/colors'
import { km, formatHours } from '../lib/format'

interface Props {
  activities: Activity[]
  loading: boolean
  hasMore: boolean
  fetchingForDates: boolean
  onFetchForDates: (after: number, before: number) => void
  isRangeLoaded: (start: Date, end: Date) => boolean
}

type SportFilter = 'all' | 'Run' | 'Ride'

export default function Progress({
  activities,
  loading,
  hasMore,
  fetchingForDates,
  onFetchForDates,
  isRangeLoaded,
}: Props) {
  const now = new Date()
  const [sport, setSport] = useState<SportFilter>('all')
  const [year, setYear] = useState(now.getFullYear())

  // Роки, в яких реально є активності (для селектора)
  const yearOptions = useMemo(() => {
    const years = new Set(activities.map((a) => new Date(a.start_date_local).getFullYear()))
    years.add(new Date().getFullYear())
    return [...years].sort((a, b) => b - a)
  }, [activities])

  const bySport = useMemo(
    () => activities.filter((a) => sport === 'all' || a.type === sport),
    [activities, sport]
  )

  const yearActs = useMemo(
    () => bySport.filter((a) => new Date(a.start_date_local).getFullYear() === year),
    [bySport, year]
  )

  // Зведення за рік
  const totalDistance = yearActs.reduce((s, a) => s + a.distance, 0)
  const totalTime = yearActs.reduce((s, a) => s + a.moving_time, 0)
  const activeDays = new Set(
    yearActs.map((a) => new Date(a.start_date_local).toDateString())
  ).size

  // Дистанція по місяцях обраного року
  const monthly = useMemo(() => {
    const sums = Array(12).fill(0)
    for (const a of yearActs) {
      sums[new Date(a.start_date_local).getMonth()] += a.distance
    }
    return sums.map((meters, i) => ({
      label: MONTH_LABELS[i],
      tooltip: `${MONTH_NAMES[i]}: ${km(meters)} km`,
      value: meters,
    }))
  }, [yearActs])

  // Дистанція за останні 12 тижнів (незалежно від обраного року)
  const weekly = useMemo(() => {
    const thisWeek = weekStart(new Date())
    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(thisWeek)
      start.setDate(thisWeek.getDate() - (11 - i) * 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 7)
      const meters = bySport
        .filter((a) => {
          const d = new Date(a.start_date_local)
          return d >= start && d < end
        })
        .reduce((s, a) => s + a.distance, 0)
      const label = `${start.getDate()}.${String(start.getMonth() + 1).padStart(2, '0')}`
      return { label, tooltip: `Week of ${label}: ${km(meters)} km`, value: meters } as BarDatum
    })
  }, [bySport])

  // Рекорди обраного року
  const records = useMemo(() => {
    const longest = yearActs.reduce<Activity | null>(
      (best, a) => (!best || a.distance > best.distance ? a : best), null
    )
    const bestMonthIdx = monthly.reduce(
      (best, m, i) => (m.value > monthly[best].value ? i : best), 0
    )
    const weekSums = new Map<number, number>()
    for (const a of yearActs) {
      const w = weekStart(new Date(a.start_date_local)).getTime()
      weekSums.set(w, (weekSums.get(w) ?? 0) + a.distance)
    }
    let bestWeek = 0
    for (const v of weekSums.values()) bestWeek = Math.max(bestWeek, v)
    return {
      longest,
      bestMonthName: monthly[bestMonthIdx].value > 0 ? MONTH_NAMES[bestMonthIdx] : null,
      bestMonthKm: monthly[bestMonthIdx].value,
      bestWeek,
      avgPerActivity: yearActs.length > 0 ? totalDistance / yearActs.length : 0,
    }
  }, [yearActs, monthly, totalDistance])

  // Порівняння: цей рік vs минулий + розподіл Run/Ride
  const comparison = useMemo(() => {
    const sumFor = (y: number) =>
      bySport
        .filter((a) => new Date(a.start_date_local).getFullYear() === y)
        .reduce((s, a) => s + a.distance, 0)
    const current = sumFor(year)
    const previous = sumFor(year - 1)

    const inYear = activities.filter((a) => new Date(a.start_date_local).getFullYear() === year)
    const runKm = inYear.filter((a) => a.type === 'Run').reduce((s, a) => s + a.distance, 0)
    const rideKm = inYear.filter((a) => a.type === 'Ride').reduce((s, a) => s + a.distance, 0)

    return { current, previous, runKm, rideKm }
  }, [activities, bySport, year])

  // Чи може статистика за вибраний рік бути неповною (див. Dashboard)
  const periodStart = new Date(year, 0, 1)
  const periodEnd = new Date(year, 11, 31, 23, 59, 59)
  const oldest = oldestDate(activities)
  const dataMayBeIncomplete =
    hasMore && oldest !== null && oldest > periodStart && !isRangeLoaded(periodStart, periodEnd)

  if (loading && activities.length === 0) {
    return (
      <div>
        <div className="progress-heading-row">
          <h2>Progress</h2>
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

  if (activities.length === 0) {
    return (
      <div>
        <h2>Progress</h2>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No statistics yet</div>
          <div className="empty-state-hint">
            Once your activities are synced from Strava, charts and records will appear here.
          </div>
        </div>
      </div>
    )
  }

  const color = sportColor(sport)
  const maxYearTotal = Math.max(comparison.current, comparison.previous, 1)
  const sportTotal = comparison.runKm + comparison.rideKm

  return (
    <div>
      <div className="progress-heading-row">
        <h2>Progress</h2>
        <div className="progress-controls">
          <div className="filter-type-toggle">
            {(['all', 'Run', 'Ride'] as SportFilter[]).map((t) => (
              <button
                key={t}
                className={`filter-type-btn${sport === t ? ' active' : ''}`}
                onClick={() => setSport(t)}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          <div className="select-wrapper">
            <select
              className="dashboard-period-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
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
          periodLabel={String(year)}
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
          <div className="stat-value">{km(totalDistance)} km</div>
          <div className="stat-label">Distance · {year}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{yearActs.length}</div>
          <div className="stat-label">Activities · {year}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatHours(totalTime)}</div>
          <div className="stat-label">Moving time · {year}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeDays}</div>
          <div className="stat-label">Active days · {year}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Distance by month — {year}</div>
          <BarChart data={monthly} color={color} />
        </div>
        <div className="chart-card">
          <div className="chart-title">Distance — last 12 weeks</div>
          <BarChart data={weekly} color={color} />
        </div>
      </div>

      <div className="progress-section">
        <div className="progress-section-title">Records · {year}</div>
        <div className="records-grid">
          <div className="record-card">
            <div className="record-label">Longest activity</div>
            <div className="record-value">
              {records.longest ? `${km(records.longest.distance)} km` : '—'}
            </div>
            {records.longest && <div className="record-sub">{records.longest.name}</div>}
          </div>
          <div className="record-card">
            <div className="record-label">Biggest week</div>
            <div className="record-value">{records.bestWeek > 0 ? `${km(records.bestWeek)} km` : '—'}</div>
          </div>
          <div className="record-card">
            <div className="record-label">Biggest month</div>
            <div className="record-value">{records.bestMonthKm > 0 ? `${km(records.bestMonthKm)} km` : '—'}</div>
            {records.bestMonthName && <div className="record-sub">{records.bestMonthName}</div>}
          </div>
          <div className="record-card">
            <div className="record-label">Avg per activity</div>
            <div className="record-value">
              {records.avgPerActivity > 0 ? `${km(records.avgPerActivity)} km` : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">{year} vs {year - 1}</div>
          <div className="hbar-list">
            <div className="hbar-row">
              <div className="hbar-head">
                <span className="hbar-name">{year}</span>
                <span className="hbar-value">{km(comparison.current)} km</span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${(comparison.current / maxYearTotal) * 100}%`, background: color }}
                />
              </div>
            </div>
            <div className="hbar-row">
              <div className="hbar-head">
                <span className="hbar-name">{year - 1}</span>
                <span className="hbar-value">{km(comparison.previous)} km</span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{ width: `${(comparison.previous / maxYearTotal) * 100}%`, background: 'var(--border-strong)' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Run / Ride split — {year}</div>
          <div className="hbar-list">
            <div className="hbar-row">
              <div className="hbar-head">
                <span className="hbar-name">Run</span>
                <span className="hbar-value">{km(comparison.runKm)} km</span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{
                    width: `${sportTotal > 0 ? (comparison.runKm / sportTotal) * 100 : 0}%`,
                    background: SPORT_COLORS.Run,
                  }}
                />
              </div>
            </div>
            <div className="hbar-row">
              <div className="hbar-head">
                <span className="hbar-name">Ride</span>
                <span className="hbar-value">{km(comparison.rideKm)} km</span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill"
                  style={{
                    width: `${sportTotal > 0 ? (comparison.rideKm / sportTotal) * 100 : 0}%`,
                    background: SPORT_COLORS.Ride,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
