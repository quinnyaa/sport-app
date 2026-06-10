// Спільний тип активності — у такому вигляді її віддає бекенд у списках
// (/activities, /activities/cached). Один на весь застосунок, щоб не
// дублювати interface у кожному компоненті.
export interface Activity {
  id: number
  name: string
  type: string
  distance: number
  moving_time: number
  start_date_local: string
}
