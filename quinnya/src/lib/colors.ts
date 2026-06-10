// Кольори видів спорту — однакові в графіках усіх вкладок.
export const SPORT_COLORS: Record<string, string> = {
  Run: '#fc4c02',
  Ride: '#3b82f6',
}

/** Колір для фільтра спорту; фіолетовий — коли вибрано "All" */
export function sportColor(sport: string): string {
  return SPORT_COLORS[sport] ?? '#8b5cf6'
}
