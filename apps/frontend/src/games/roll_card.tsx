import { useEffect, useRef } from 'react'
import { Dice5 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { gaugePercent, percentileDice } from './presentation'
import type { LiveRoll } from './roll_reveal'
import { DEGREE_EMPHASIS, ROLL_TONE, rollText } from './roll_text'

/** Between two parts of the roll as it is set out. */
const STEP_MS = 250
/** The roll set out in full, before an automatic throw. */
const SETTLE_MS = 600
/** The tens die stops first, the units die after: the d100 is read on the second. */
const TENS_MS = 800
const UNITS_MS = 1300
/** A hidden tab may never report the end of the animation: the dice stop anyway. */
const STOP_FALLBACK_MS = UNITS_MS + 700
/** The degree in view, before the card folds into its chip. */
const LANDED_MS = 1500
/** Faces run past before the die settles: two full turns, then the face it stops on. */
const TURNS = 2

/**
 * A live roll, played out (front spec, section 5.3.7): set out part by part
 * with the chance on a gauge, thrown — by the player, or on its own — and
 * read on two d10. The d100 was drawn by the backend before the card ever
 * showed: the throw reveals it, nothing the player does changes it.
 *
 * Its timing is its own: it tells the reveal machine when the dice stop and
 * when it has folded. The dice and the gauge are hidden from screen readers;
 * the roll is announced once revealed, with the turn.
 */
export function RollCard({
  live,
  onThrow,
  onDiceStopped,
  onFolded,
}: {
  live: LiveRoll
  onThrow: () => void
  onDiceStopped: () => void
  onFolded: () => void
}) {
  const { t } = useTranslation('game')
  const { status, roll, animated, autoRoll } = live
  const text = rollText(roll, t)
  const parts = [...text.setup, ...(text.chance ? [text.chance] : [])]
  const dice = percentileDice(roll.roll)
  const button = useRef<HTMLButtonElement>(null)

  // Waiting for the player: the button takes the focus, the input being locked anyway.
  useEffect(() => {
    if (status === 'staged' && !autoRoll) button.current?.focus({ preventScroll: true })
  }, [status, autoRoll])

  useEffect(() => {
    if (status !== 'staged' || !autoRoll) return
    const timer = setTimeout(onThrow, parts.length * STEP_MS + SETTLE_MS)
    return () => clearTimeout(timer)
  }, [status, autoRoll, parts.length, onThrow])

  useEffect(() => {
    if (status !== 'rolling') return
    const timer = setTimeout(onDiceStopped, STOP_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [status, onDiceStopped])

  useEffect(() => {
    if (status !== 'landed') return
    const timer = setTimeout(onFolded, LANDED_MS)
    return () => clearTimeout(timer)
  }, [status, onFolded])

  const thrown = status !== 'staged'
  const spinning = status === 'rolling'

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border-strong bg-surface-2 px-5 py-4">
      <p className="flex flex-wrap justify-center gap-x-2 text-center text-label text-text">
        {parts.map((part, index) => (
          <span
            key={index}
            className={`after:ml-2 after:text-subtle after:content-['·'] last:after:content-none ${animated ? 'animate-fade-in' : ''}`}
            style={animated ? { animationDelay: `${index * STEP_MS}ms` } : undefined}
          >
            {part}
          </span>
        ))}
      </p>

      <ChanceGauge chance={roll.chance} rolled={thrown ? roll.roll : null} sliding={spinning} />

      <div aria-hidden className="flex gap-3">
        <Die
          face={(n) => `${n}0`}
          stop={dice.tens}
          shown={thrown}
          spinning={spinning}
          ms={TENS_MS}
        />
        <Die
          face={(n) => `${n}`}
          stop={dice.units}
          shown={thrown}
          spinning={spinning}
          ms={UNITS_MS}
          onStopped={onDiceStopped}
        />
      </div>

      {status === 'staged' && !autoRoll && (
        <button
          ref={button}
          type="button"
          onClick={onThrow}
          className="flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-label font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Dice5 aria-hidden className="size-4" />
          {t('journal.roll.throw')}
        </button>
      )}

      {status === 'landed' && (
        <p
          className={`rounded-sm border px-3 py-1 text-label ${ROLL_TONE[roll.result]} ${DEGREE_EMPHASIS[roll.degree]} ${LANDING[roll.degree]}`}
        >
          {`${text.rolled} · ${text.degree}`}
        </p>
      )}
    </div>
  )
}

/** A critical glows, a fumble shakes; the other degrees simply appear. */
const LANDING: Record<LiveRoll['roll']['degree'], string> = {
  critical: 'animate-fade-in shadow-[0_0_24px_var(--color-success)]',
  special: 'animate-fade-in',
  success: 'animate-fade-in',
  failure: 'animate-fade-in',
  fumble: 'animate-shake',
}

/**
 * From 0 to 100, marked at the chance only: no zone of degree, which would
 * mean working the rules out on the front. Once thrown, a marker slides to
 * the d100.
 */
function ChanceGauge({
  chance,
  rolled,
  sliding,
}: {
  chance: number
  rolled: number | null
  sliding: boolean
}) {
  const at = `${gaugePercent(chance, 100)}%`

  return (
    <div aria-hidden className="relative my-1 h-1.5 w-full rounded-full bg-surface-1">
      <div className="h-full rounded-full bg-accent/30" style={{ width: at }} />
      <div
        className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 bg-accent"
        style={{ left: at }}
      />
      {rolled !== null && (
        <div
          className={`absolute -top-1.5 size-4.5 -translate-x-1/2 rounded-sm border-2 border-text bg-surface-2 ${sliding ? 'animate-slide-in' : ''}`}
          style={{ left: `${gaugePercent(rolled, 100)}%`, animationDuration: `${UNITS_MS}ms` }}
        />
      )}
    </div>
  )
}

/**
 * One d10: a column of faces that runs past and stops on its own. Before the
 * throw, a die icon stands in for the face.
 */
function Die({
  face,
  stop,
  shown,
  spinning,
  ms,
  onStopped,
}: {
  face: (n: number) => string
  stop: number
  shown: boolean
  spinning: boolean
  ms: number
  onStopped?: () => void
}) {
  const faces = Array.from({ length: (TURNS + 1) * 10 }, (_, index) => face(index % 10))

  return (
    <div className="h-12 w-14 overflow-hidden rounded-md border border-border-strong bg-surface-1 text-xl font-medium text-text tabular-nums">
      {shown ? (
        <div
          className={spinning ? 'animate-dice-spin' : undefined}
          style={{
            transform: `translateY(-${(TURNS * 10 + stop) * 3}rem)`,
            animationDuration: `${ms}ms`,
          }}
          onAnimationEnd={onStopped}
        >
          {faces.map((label, index) => (
            <div key={index} className="grid h-12 place-items-center">
              {label}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid h-full place-items-center text-subtle">
          <Dice5 className="size-5" />
        </div>
      )}
    </div>
  )
}
