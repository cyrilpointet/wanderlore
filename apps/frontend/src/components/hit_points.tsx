import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { filledPips } from '@/games/presentation'
import { animates, preferences, systemReducesMotion } from '@/preferences'

/** Up, down, and twice again lower: a ball settling. */
const BOUNCE: Keyframe[] = [
  { transform: 'translateY(0) scale(1)', easing: 'ease-out' },
  { transform: 'translateY(-6px) scale(1.06)', offset: 0.2, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1)', offset: 0.4, easing: 'ease-out' },
  { transform: 'translateY(-3px) scale(1.03)', offset: 0.55, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1)', offset: 0.7, easing: 'ease-out' },
  { transform: 'translateY(-1px) scale(1)', offset: 0.82, easing: 'ease-in' },
  { transform: 'translateY(0) scale(1)' },
]

const SIZES = {
  small: { row: 'gap-1', pip: 'size-2', value: 'text-[0.8125rem]' },
  large: { row: 'gap-1.5', pip: 'size-3', value: 'text-label' },
}

/**
 * Hit points as pips, one per point: filled for those left, ringed for those
 * lost, then `8 / 10`. Always brick, never green, which means a successful
 * roll (front spec, section 8). When the value changes at the end of a turn —
 * not when the screen opens — the pips bounce and pulse, unless the player
 * or the system turned that off.
 */
export function HitPoints({
  current,
  max,
  size = 'small',
  value = true,
  className = '',
}: {
  current: number
  max: number
  size?: keyof typeof SIZES
  /** `8 / 10` after the pips; left out where the value is written elsewhere. */
  value?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const pips = useRef<HTMLSpanElement>(null)
  const shown = useRef(current)
  const filled = filledPips(current, max)

  useEffect(() => {
    if (shown.current === current) return
    shown.current = current

    if (!animates(preferences.get(), 'hitPoints', systemReducesMotion())) return
    const row = pips.current
    row?.animate(BOUNCE, { duration: 900 })
    row?.querySelectorAll('[data-filled]').forEach((pip) =>
      pip.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
        duration: 600,
        iterations: 2,
      })
    )
  }, [current])

  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <span ref={pips} aria-hidden className={`flex flex-wrap ${SIZES[size].row}`}>
        {Array.from({ length: max }, (_, index) =>
          index < filled ? (
            <span key={index} data-filled className={`${SIZES[size].pip} rounded-full bg-hp`} />
          ) : (
            <span
              key={index}
              className={`${SIZES[size].pip} rounded-full shadow-[inset_0_0_0_1.5px_var(--color-hp)]`}
            />
          )
        )}
      </span>
      {value && (
        <span
          aria-hidden
          className={`shrink-0 font-semibold whitespace-nowrap text-hp tabular-nums ${SIZES[size].value}`}
        >
          {t('hitPoints.value', { current, max })}
        </span>
      )}
      <span className="sr-only">{t('hitPoints.label', { current, max })}</span>
    </span>
  )
}
