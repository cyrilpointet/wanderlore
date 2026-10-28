import { useEffect, useRef } from 'react'

import { animates, preferences, systemReducesMotion } from '@/preferences'
import { gaugePercent } from './presentation'

/** Up, down, and twice again lower: a ball settling. */
const BOUNCE: Keyframe[] = [
  { transform: 'translateY(0) scale(1)', easing: 'ease-out' },
  { transform: 'translateY(-6px) scale(1.12)', offset: 0.2, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1)', offset: 0.4, easing: 'ease-out' },
  { transform: 'translateY(-3px) scale(1.05)', offset: 0.55, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1)', offset: 0.7, easing: 'ease-out' },
  { transform: 'translateY(-1px) scale(1)', offset: 0.82, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1)' },
]

/**
 * The bar alone: always brick red, never green (front spec, section 8). When
 * the value changes at the end of a turn — gained or lost, not when the screen
 * opens — it bounces to catch the eye and its fill pulses, unless the player
 * or the system turned that off.
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
  const gauge = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const shown = useRef(current)

  useEffect(() => {
    if (shown.current === current) return
    shown.current = current

    if (!animates(preferences.get(), 'hitPoints', systemReducesMotion())) return
    gauge.current?.animate(BOUNCE, { duration: 900 })
    bar.current?.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
      duration: 600,
      iterations: 2,
    })
  }, [current])

  return (
    <div
      ref={gauge}
      aria-hidden
      className={`h-1.5 overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div
        ref={bar}
        className="h-full rounded-full bg-danger transition-[width] duration-500"
        style={{ width: `${gaugePercent(current, max)}%` }}
      />
    </div>
  )
}
