import { useEffect, useRef } from 'react'

import { gaugePercent } from './presentation'

/**
 * The bar alone: always brick red, never green (front spec, section 8). It
 * pulses briefly when the value changes at the end of a turn — not when the
 * screen opens.
 */
export function HitPointGauge({
  current,
  max,
  className = '',
}: {
  current: number
  max: number
  className?: string
}) {
  const bar = useRef<HTMLDivElement>(null)
  const shown = useRef(current)

  useEffect(() => {
    if (shown.current === current) return
    shown.current = current

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    bar.current?.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
      duration: 600,
      iterations: 2,
    })
  }, [current])

  return (
    <div aria-hidden className={`h-1.5 overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <div
        ref={bar}
        className="h-full rounded-full bg-danger transition-[width] duration-500"
        style={{ width: `${gaugePercent(current, max)}%` }}
      />
    </div>
  )
}
