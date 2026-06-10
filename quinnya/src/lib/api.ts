// Спільне для запитів до бекенда.
export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** Тягне GPX з бекенда і запускає збереження файлу в браузері */
export async function downloadGpx(activityId: number, token: string) {
  const res = await fetch(`${API}/activities/${activityId}/gpx`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const cd = res.headers.get('content-disposition')
  const match = cd?.match(/filename="(.+)"/)
  a.download = match ? match[1] : `activity_${activityId}.gpx`
  a.click()
  URL.revokeObjectURL(url)
}
