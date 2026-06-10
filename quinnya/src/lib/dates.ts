// Спільні константи та хелпери для роботи з датами.

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Понеділок тижня, в який потрапляє дата */
export function weekStart(d: Date): Date {
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return monday
}

/** Кінець доби (23:59:59) — стабільна права межа періоду «до сьогодні» */
export function endOfDay(d: Date): Date {
  const end = new Date(d)
  end.setHours(23, 59, 59, 0)
  return end
}

/** Роки для селекторів: від поточного вниз до 2010 */
export function buildYearOptions(): number[] {
  const years: number[] = []
  for (let y = new Date().getFullYear(); y >= 2010; y--) years.push(y)
  return years
}

/** Дата найстарішої завантаженої активності (null, якщо список порожній) */
export function oldestDate(activities: { start_date_local: string }[]): Date | null {
  if (activities.length === 0) return null
  let oldest = new Date(activities[0].start_date_local)
  for (const a of activities) {
    const d = new Date(a.start_date_local)
    if (d < oldest) oldest = d
  }
  return oldest
}
