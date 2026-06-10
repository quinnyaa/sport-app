// Усі форматери чисел і часу — в одному місці, щоб однакові величини
// виглядали однаково в усіх вкладках.

/** "4.00 km" — точна дистанція в списку активностей */
export function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2) + ' km'
}

/** "25.3" / "156" — короткий запис км без одиниць (картки статистики) */
export function km(meters: number): string {
  const v = meters / 1000
  return v >= 100 ? v.toFixed(0) : v.toFixed(1)
}

/** "1h 6min" / "22 min" — тривалість людською мовою (список активностей) */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

/** "14h 13m" / "45m" — компактна тривалість (картки статистики).
    Округлюємо загальні хвилини ПЕРЕД діленням на години, інакше 59.6 хв
    округлилось би до 60 і вийшло б "1h 60m". */
export function formatHours(seconds: number): string {
  const totalMin = Math.round(seconds / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "22:59" / "1:02:03" — час у форматі секундоміра (деталі активності) */
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "5:45" — темп хв:сек на км зі швидкості в м/с.
    Спочатку округлюємо ЗАГАЛЬНІ секунди, і лише потім ділимо на хвилини —
    інакше залишок 59.7 с округлився б до 60 і вийшло б "4:60". */
export function pace(speedMs: number): string {
  if (!speedMs) return '—'
  const totalSec = Math.round(1000 / speedMs)
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`
}
