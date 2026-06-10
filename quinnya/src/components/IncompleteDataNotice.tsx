interface Props {
  periodLabel: string
  oldestLoaded: Date
  loading: boolean
  onLoad: () => void
}

// Попередження, що статистика порахована на неповних даних: у Strava ще
// лишилися старіші активності, які не завантажені в застосунок. Кнопка
// довантажує вибраний період через /activities?after=&before=.
export default function IncompleteDataNotice({ periodLabel, oldestLoaded, loading, onLoad }: Props) {
  return (
    <div className="filter-fetch-banner">
      <span>
        Stats for {periodLabel} may be incomplete — activities before{' '}
        {oldestLoaded.toLocaleDateString('en-GB')} are not loaded yet.
      </span>
      <button className="filter-fetch-btn" onClick={onLoad} disabled={loading}>
        {loading ? 'Loading…' : `Load ${periodLabel}`}
      </button>
    </div>
  )
}
