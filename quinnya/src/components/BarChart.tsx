import { useState } from 'react'

// Один стовпчик графіка: підпис під віссю, текст тултіпа і значення.
export interface BarDatum {
  label: string
  tooltip: string
  value: number
}

// Спільний стовпчиковий графік для Dashboard, Progress і деталей активності.
// Висота стовпчика — відсоток від максимуму в наборі; тултіп показується на hover.
export default function BarChart({ data, color }: { data: BarDatum[]; color: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div
          key={i}
          className="bar-col"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="bar-wrapper">
            {d.value > 0 && (
              <div className="bar" style={{ height: `${(d.value / max) * 100}%`, background: color }}>
                {hovered === i && <div className="bar-tooltip">{d.tooltip}</div>}
              </div>
            )}
          </div>
          <div className="bar-label">{d.label}</div>
        </div>
      ))}
    </div>
  )
}
