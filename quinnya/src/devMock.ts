// Локальний мок-режим для розробки БЕЗ Strava-токена та бекенда.
// Вмикається через VITE_MOCK=1 у quinnya/.env.local (у git не потрапляє, прод не зачіпає).
//
// Що робить, коли увімкнений:
//  1) кладе фейковий токен у localStorage → екран логіна пропускається;
//  2) перехоплює window.fetch і повертає нагенеровані дані для ендпоінтів бекенда
//     (/activities/cached, /activities, /activitydetails, /gpx), а всі інші запити
//     (наприклад тайли мапи OpenStreetMap) пропускає у справжній fetch без змін.

const MOCK_ON = import.meta.env.VITE_MOCK === '1' || import.meta.env.VITE_MOCK === 'true'

// ── Кодування polyline (зворотне до decodePolyline в ActivityDetail) ──────────
function encodePolyline(coords: [number, number][]): string {
  let lastLat = 0
  let lastLng = 0
  let result = ''
  const encodeVal = (v: number): string => {
    let sgn = v < 0 ? ~(v << 1) : v << 1
    let out = ''
    while (sgn >= 0x20) {
      out += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63)
      sgn >>= 5
    }
    out += String.fromCharCode(sgn + 63)
    return out
  }
  for (const [lat, lng] of coords) {
    const iLat = Math.round(lat * 1e5)
    const iLng = Math.round(lng * 1e5)
    result += encodeVal(iLat - lastLat) + encodeVal(iLng - lastLng)
    lastLat = iLat
    lastLng = iLng
  }
  return result
}

// Демо-маршрут (петля в Києві) — щоб мапа Leaflet рендерилась.
const ROUTE: [number, number][] = [
  [50.4501, 30.5234], [50.452, 30.524], [50.4535, 30.526], [50.4548, 30.5285],
  [50.4555, 30.5312], [50.4549, 30.534], [50.4533, 30.5358], [50.4512, 30.5362],
  [50.4495, 30.535], [50.4486, 30.5325], [50.4488, 30.5298], [50.4495, 30.5268],
  [50.4501, 30.5234],
]
const ROUTE_POLYLINE = encodePolyline(ROUTE)

// ── Генерація списку активностей ──────────────────────────────────────────────
interface MockActivity {
  id: number
  name: string
  type: 'Run' | 'Ride'
  distance: number
  moving_time: number
  start_date_local: string
}

function buildActivities(): MockActivity[] {
  const runNames = ['Morning Run', 'Tempo Run', 'Long Run', 'Easy Recovery', 'Evening Jog', 'Interval Session']
  const rideNames = ['Weekend Ride', 'Commute', 'Hill Repeats', 'Gravel Loop', 'City Spin', 'Endurance Ride']
  const list: MockActivity[] = []
  const now = Date.now()
  for (let i = 0; i < 12; i++) {
    const isRun = i % 2 === 0
    const date = new Date(now - i * 5 * 24 * 60 * 60 * 1000) // кожні ~5 днів назад
    const distance = isRun
      ? 4000 + ((i * 1300) % 12000)   // 4–16 км
      : 18000 + ((i * 4000) % 50000)  // 18–68 км
    const speed = isRun ? 2.9 : 7.5    // м/с (~5:45/км біг, ~27 км/год вело)
    list.push({
      id: 1000 + i,
      name: isRun ? runNames[i % runNames.length] : rideNames[i % rideNames.length],
      type: isRun ? 'Run' : 'Ride',
      distance,
      moving_time: Math.round(distance / speed),
      start_date_local: date.toISOString(),
    })
  }
  return list
}

const ACTIVITIES = buildActivities()

// ── Генерація деталей активності ──────────────────────────────────────────────
function buildSplits(distanceM: number, baseSpeed: number) {
  const km = Math.max(1, Math.round(distanceM / 1000))
  return Array.from({ length: km }, (_, i) => {
    const speed = baseSpeed * (0.92 + ((i * 7) % 16) / 100) // невелика варіація
    return {
      distance: 1000,
      moving_time: Math.round(1000 / speed),
      average_speed: speed,
      elevation_difference: ((i * 13) % 21) - 10,
      average_heartrate: 150 + ((i * 9) % 30),
    }
  })
}

function buildDetail(id: number) {
  const a = ACTIVITIES.find((x) => x.id === id) ?? ACTIVITIES[0]
  const isRun = a.type === 'Run'
  const baseSpeed = a.distance / a.moving_time
  return {
    ...a,
    elapsed_time: Math.round(a.moving_time * 1.08),
    total_elevation_gain: isRun ? 45 + (id % 60) : 320 + (id % 400),
    average_speed: baseSpeed,
    max_speed: baseSpeed * 1.6,
    average_heartrate: 152,
    max_heartrate: 178,
    average_cadence: isRun ? 86 : 78,
    calories: Math.round(a.distance / (isRun ? 13 : 45)),
    suffer_score: 40 + (id % 80),
    kudos_count: 5 + (id % 15),
    achievement_count: id % 4,
    gear: { name: isRun ? 'Nike Pegasus 40' : 'Canyon Endurace' },
    splits_metric: isRun ? buildSplits(a.distance, baseSpeed) : undefined,
    best_efforts: isRun
      ? [
          { name: '400m', elapsed_time: 82 },
          { name: '1k', elapsed_time: 230 },
          { name: '5k', elapsed_time: 1290 },
        ]
      : undefined,
    average_watts: isRun ? undefined : 185,
    weighted_average_watts: isRun ? undefined : 198,
    kilojoules: isRun ? undefined : Math.round(a.moving_time * 0.185),
    map: { summary_polyline: ROUTE_POLYLINE, polyline: ROUTE_POLYLINE },
  }
}

// ── Хелпери відповідей ────────────────────────────────────────────────────────
function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function gpxResponse(id: number): Response {
  const pts = ROUTE.map(([lat, lng]) => `<trkpt lat="${lat}" lon="${lng}"></trkpt>`).join('')
  const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Activity ${id}</name><trkseg>${pts}</trkseg></trk></gpx>`
  return new Response(gpx, {
    status: 200,
    headers: {
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="activity_${id}.gpx"`,
    },
  })
}

// ── Установка моку ────────────────────────────────────────────────────────────
export function installDevMock(): void {
  if (!MOCK_ON) return

  // 1) фейковий токен → екран логіна пропускається
  if (!localStorage.getItem('quinnya_session')) {
    localStorage.setItem('quinnya_session', 'mock-token')
  }
  localStorage.setItem('athlete_name', 'Demo Athlete')

  // 2) перехоплення fetch
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    // GPX-завантаження: /activities/{id}/gpx
    const gpxMatch = url.match(/\/activities\/(\d+)\/gpx/)
    if (gpxMatch) return gpxResponse(Number(gpxMatch[1]))

    // Деталі: /activitydetails?id=123
    const detailMatch = url.match(/\/activitydetails\?id=(\d+)/)
    if (detailMatch) return jsonResponse(buildDetail(Number(detailMatch[1])))

    // Список (кеш або зі Strava): /activities/cached, /activities?...
    if (url.includes('/activities/cached') || /\/activities(\?|$)/.test(url)) {
      return jsonResponse(ACTIVITIES)
    }

    // logout — просто ок
    if (url.includes('/auth/logout')) return jsonResponse({ ok: true })

    // решта (тайли мапи тощо) — справжній fetch
    return realFetch(input, init)
  }

  console.info('[devMock] Mock mode ON — using generated data, no Strava/backend needed')
}
