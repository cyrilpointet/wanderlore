import { gaugePercent } from './presentation'

/** The bar alone: always brick red, never green (front spec, section 8). */
export function HitPointGauge({
  current,
  max,
  className = '',
}: {
  current: number
  max: number
  className?: string
}) {
  return (
    <div aria-hidden className={`h-1.5 overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <div
        className="h-full rounded-full bg-danger transition-[width] duration-500"
        style={{ width: `${gaugePercent(current, max)}%` }}
      />
    </div>
  )
}
