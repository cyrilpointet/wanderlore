import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION } from '@/components/actions'
import { D10 } from '@/components/dice'
import { Stamp } from '@/components/stamp'
import { CARD, LABEL } from '@/components/surfaces'
import { percentileDice } from './presentation'
import type { LiveRoll } from './roll_reveal'
import { damageLine, rollText, stampText } from './roll_text'

/** Between two parts of the roll as it is set out. */
const STEP_MS = 250
/** The roll set out in full, before an automatic throw. */
const SETTLE_MS = 600
/** The tens die stops first, the units die after: the d100 is read on the second. */
const TENS_MS = 800
const UNITS_MS = 1300
/** A hidden tab may never report the end of the animation: the dice stop anyway. */
const STOP_FALLBACK_MS = UNITS_MS + 700
/** The degree in view, before the roll joins the sheet as a card. */
const LANDED_MS = 1500
/** Faces run past before the die settles: two full turns, then the face it stops on. */
const TURNS = 2
/** The height of the top face of a large d10, where its faces run past. */
const FACE_PX = 21

/**
 * A live roll, played out in the dice tray (front spec, section 5.3.7): its
 * card set out part by part, then two d10 thrown — by the player, or on their
 * own — and read. The d100 was drawn by the backend before the card ever
 * showed: the throw reveals it, nothing the player does changes it.
 *
 * In combat, the card says from the start what the roll is — the attack, or
 * which defence — and against whom; once the dice have stopped, the outcome
 * is stamped with the degree — and the damage a blow dealt, in full, never
 * thrown by hand.
 *
 * Its timing is its own: it tells the reveal machine when the dice stop and
 * when it has folded. The dice are hidden from screen readers; the roll is
 * announced once revealed, with the turn.
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
  const [title, ...lines] = text.heading ? [text.heading, ...text.setup] : text.setup
  const dice = percentileDice(roll.roll)
  const button = useRef<HTMLButtonElement>(null)
  // The parts set out one after the other: what is rolled, the lines, then the chance.
  const steps = lines.length + 2

  // Waiting for the player: the button takes the focus, the input being locked anyway.
  useEffect(() => {
    if (status === 'staged' && !autoRoll) button.current?.focus({ preventScroll: true })
  }, [status, autoRoll])

  useEffect(() => {
    if (status !== 'staged' || !autoRoll) return
    const timer = setTimeout(onThrow, steps * STEP_MS + SETTLE_MS)
    return () => clearTimeout(timer)
  }, [status, autoRoll, steps, onThrow])

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
  const appear = (index: number) =>
    animated
      ? { className: 'animate-fade-in', style: { animationDelay: `${index * STEP_MS}ms` } }
      : {}

  return (
    <>
      <div className={`${CARD} flex flex-col gap-1.5 px-4 py-3.5`}>
        <h3
          {...appear(0)}
          // The class of `appear` would replace this one: the title keeps its own.
        >
          <span className="mb-0.5 block font-serif text-[1.0625rem] leading-snug font-semibold text-text">
            {title}
          </span>
        </h3>
        {lines.map((line, index) => (
          <p key={index} {...appear(index + 1)}>
            <span className="text-sm text-muted tabular-nums">{line}</span>
          </p>
        ))}
        <p
          {...appear(lines.length + 1)}
          // The chance in full, even when no modifier moved it: it is what the dice are read against.
        >
          <span className="mt-1 flex items-baseline justify-between border-t border-dashed border-border pt-2">
            <span className={LABEL}>{t('journal.roll.chanceLabel')}</span>
            <span className="text-[1.75rem] leading-none font-semibold text-text tabular-nums">
              {t('journal.roll.chance', { chance: roll.chance })}
            </span>
          </span>
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div aria-hidden className="flex gap-7">
          <Die
            label={t('journal.roll.tens')}
            face={(n) => `${n}0`}
            stop={dice.tens}
            shown={thrown}
            spinning={spinning}
            ms={TENS_MS}
          />
          <Die
            label={t('journal.roll.units')}
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
            className={`${PRIMARY_ACTION} w-full`}
          >
            {t('journal.roll.throw')}
          </button>
        )}

        {status === 'landed' && (
          <div className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2">
            <span className="text-lg font-semibold text-text tabular-nums">
              {t('journal.roll.rolled', { roll: roll.roll })}
            </span>
            <Stamp
              tone={roll.result === 'success' ? 'success' : 'failure'}
              className={LANDING[roll.degree]}
            >
              {stampText(text)}
            </Stamp>
            {text.damage.length > 0 && (
              <span className="basis-full animate-fade-in text-center text-[0.78125rem] text-muted">
                {damageLine(text)}
              </span>
            )}
          </div>
        )}
      </div>
    </>
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
 * One d10, its name under it. Before the throw it shows `?`; thrown, a column
 * of faces runs past on its top face and stops on its own.
 */
function Die({
  label,
  face,
  stop,
  shown,
  spinning,
  ms,
  onStopped,
}: {
  label: string
  face: (n: number) => string
  stop: number
  shown: boolean
  spinning: boolean
  ms: number
  onStopped?: () => void
}) {
  const faces = Array.from({ length: (TURNS + 1) * 10 }, (_, index) => face(index % 10))

  return (
    <div className="flex flex-col items-center gap-1">
      <D10
        size="large"
        face={
          shown ? (
            <span
              className={`self-start ${spinning ? 'animate-dice-spin' : ''}`}
              style={{
                transform: `translateY(-${(TURNS * 10 + stop) * FACE_PX}px)`,
                animationDuration: `${ms}ms`,
              }}
              onAnimationEnd={onStopped}
            >
              {faces.map((value, index) => (
                <span key={index} className="grid place-items-center" style={{ height: FACE_PX }}>
                  {value}
                </span>
              ))}
            </span>
          ) : (
            '?'
          )
        }
      />
      <span className={`${LABEL} text-[0.625rem]`}>{label}</span>
    </div>
  )
}
