import { useState, useEffect } from 'react'

interface Activity {
  id: number
  type: string
  distance: number
  moving_time: number
  start_date_local: string
}

interface Goal {
  id: string
  name?: string
  type: 'Run' | 'Ride'
  period: 'week' | 'month'
  target: number
}

interface Props {
  activities: Activity[]
}

function getWeekStart(): Date {
  const now = new Date()
  const diff = (now.getDay() + 6) % 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function formatPace(movingTime: number, distance: number): string {
  const secPerKm = (movingTime / distance) * 1000
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')} /km`
}

export default function Goals({ activities }: Props) {
  const now = new Date()

  const [goals, setGoals] = useState<Goal[]>(() => {
    try { return JSON.parse(localStorage.getItem('quinnya_goals') ?? '[]') }
    catch { return [] }
  })
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'Run' | 'Ride'>('Run')
  const [newPeriod, setNewPeriod] = useState<'week' | 'month'>('month')
  const [newTarget, setNewTarget] = useState('')
  const [formError, setFormError] = useState('')

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [selYear, setSelYear] = useState(now.getFullYear())

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]

  const yearOptions: number[] = []
  for (let y = now.getFullYear(); y >= 2010; y--) yearOptions.push(y)

  useEffect(() => {
    localStorage.setItem('quinnya_goals', JSON.stringify(goals))
  }, [goals])

  function addGoal() {
    const km = parseFloat(newTarget)
    if (!km || km <= 0) {
      setFormError('Please enter a distance in km')
      return
    }
    setFormError('')
    setGoals(prev => [{
      id: Date.now().toString(),
      name: newName.trim() || undefined,
      type: newType,
      period: newPeriod,
      target: km,
    }, ...prev])
    setNewTarget('')
    setNewName('')
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const next = [...goals]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setGoals(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function getActualKm(goal: Goal): number {
    const weekStart = getWeekStart()
    return activities
      .filter(a => {
        if (a.type !== goal.type) return false
        const d = new Date(a.start_date_local)
        if (goal.period === 'week') return d >= weekStart
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, a) => sum + a.distance / 1000, 0)
  }

  const monthActs = activities.filter(a => {
    const d = new Date(a.start_date_local)
    return d.getMonth() === selMonth && d.getFullYear() === selYear
  })
  const runs = monthActs.filter(a => a.type === 'Run')
  const rides = monthActs.filter(a => a.type === 'Ride')

  const longestRun = runs.reduce((m, a) => Math.max(m, a.distance), 0)
  const longestRide = rides.reduce((m, a) => Math.max(m, a.distance), 0)
  const totalRunKm = runs.reduce((sum, a) => sum + a.distance / 1000, 0)
  const totalRideKm = rides.reduce((sum, a) => sum + a.distance / 1000, 0)
  const fastestPaceRun = runs
    .filter(a => a.distance >= 1000)
    .reduce<Activity | null>((best, a) => {
      if (!best) return a
      return a.moving_time / a.distance < best.moving_time / best.distance ? a : best
    }, null)

  return (
    <div className="goals-layout">
      <div className="goals-left">
        <h2>My Goals</h2>

        <div className="goal-form">
          <input
            type="text"
            className="goal-input"
            placeholder="Goal name (optional)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <div className="type-toggle">
            <button className={`toggle-btn ${newType === 'Run' ? 'active' : ''}`} onClick={() => setNewType('Run')}>Run</button>
            <button className={`toggle-btn ${newType === 'Ride' ? 'active' : ''}`} onClick={() => setNewType('Ride')}>Ride</button>
          </div>
          <div className="goal-form-row">
            <input
              type="number"
              className={`goal-input ${formError ? 'input-error' : ''}`}
              placeholder="Distance (km)"
              value={newTarget}
              min="1"
              onChange={e => { setNewTarget(e.target.value); setFormError('') }}
            />
            <span className="goal-per">per</span>
            <div className="select-wrapper">
              <select className="goal-select" value={newPeriod} onChange={e => setNewPeriod(e.target.value as 'week' | 'month')}>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
          </div>
          {formError && <p className="form-error">{formError}</p>}
          <button className="add-goal-btn" onClick={addGoal}>Add Goal</button>
        </div>

        <div className="goals-list">
          {goals.length === 0 && <p className="no-goals">No goals yet. Add your first one above.</p>}
          {goals.map((goal, i) => {
            const actual = getActualKm(goal)
            const pct = Math.min((actual / goal.target) * 100, 100)
            const done = actual >= goal.target
            const isDragging = dragIndex === i
            const isOver = dragOverIndex === i && dragIndex !== i
            return (
              <div
                key={goal.id}
                className={`goal-card${isDragging ? ' dragging' : ''}${isOver ? ' drag-over' : ''}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
              >
                <div className="goal-card-header">
                  <span className="goal-drag-handle">⠿</span>
                  <div className="goal-card-titles">
                    {goal.name && <span className="goal-name">{goal.name}</span>}
                    <span className="goal-tag">{goal.type} · {goal.target} km / {goal.period}</span>
                  </div>
                  <button className="goal-remove" onClick={() => setGoals(p => p.filter(g => g.id !== goal.id))}>✕</button>
                </div>
                <div className="goal-bar-track">
                  <div className={`goal-bar-fill${done ? ' done' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-footer">
                  <span>{actual.toFixed(1)} / {goal.target} km</span>
                  <span className={done ? 'goal-done' : ''}>{done ? 'Completed' : `${pct.toFixed(0)}%`}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="goals-right">
        <div className="achievements-header">
          <h2>Achievements</h2>
          <div className="select-wrapper">
            <select
              className="dashboard-period-select"
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
          <div className="select-wrapper">
            <select
              className="dashboard-period-select"
              value={selYear}
              onChange={e => setSelYear(Number(e.target.value))}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="achievements-list">
          <div className="achievement-card">
            <div className="achievement-row">
              <div>
                <div className="achievement-label">Longest Run</div>
                <div className="achievement-value">{longestRun > 0 ? `${(longestRun / 1000).toFixed(2)} km` : '—'}</div>
              </div>
              <div className="achievement-total">
                <div className="achievement-label">Total</div>
                <div className="achievement-value">{totalRunKm > 0 ? `${totalRunKm.toFixed(1)} km` : '—'}</div>
              </div>
            </div>
          </div>
          <div className="achievement-card">
            <div className="achievement-row">
              <div>
                <div className="achievement-label">Longest Ride</div>
                <div className="achievement-value">{longestRide > 0 ? `${(longestRide / 1000).toFixed(2)} km` : '—'}</div>
              </div>
              <div className="achievement-total">
                <div className="achievement-label">Total</div>
                <div className="achievement-value">{totalRideKm > 0 ? `${totalRideKm.toFixed(1)} km` : '—'}</div>
              </div>
            </div>
          </div>
          <div className="achievement-card">
            <div className="achievement-label">Fastest Run Pace</div>
            <div className="achievement-value">
              {fastestPaceRun ? formatPace(fastestPaceRun.moving_time, fastestPaceRun.distance) : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
