import { Dice5, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION, SECONDARY_ACTION } from '@/components/actions'
import { TRAY } from '@/components/surfaces'
import type { CharacteristicRoll } from '../queries'

/** The faces of a d6. */
const FACES = [1, 2, 3, 4, 5, 6]
/** Two full turns of the faces, then the one the die stops on. */
const TURNS = 2
/** The first die settles after this; each die after it a little later, read one by one. */
const FIRST_MS = 600
const STAGGER_MS = 90
/** The height of a face, in rem (30 px): the column is moved by whole faces. */
const FACE_REM = 1.875

/**
 * Where the pips sit on a 3 × 3 grid, cell by cell (0 to 8, row by row): a
 * matter of drawing, not of rules.
 */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/** Four d6 for each result: the backend keeps the best three. */
const DICE = [0, 1, 2, 3]

/**
 * The seven results, drawn by the backend and only revealed here: no throw
 * by hand, the draw is not a roll of the game (front spec, section 5.6).
 * Each result shows its four d6 as the backend drew them, the one it set
 * aside greyed out, and the total of the others, which is what the
 * placement works on.
 */
export function DiceStep({
  roll,
  rolling,
  error,
  animated,
  onRoll,
}: {
  roll: CharacteristicRoll | null
  /** A draw is on its way. */
  rolling: boolean
  /** Why the last draw failed, already worded for the player. */
  error: string | null
  /** The dice animation, as the preferences and the system allow it. */
  animated: boolean
  onRoll: () => void
}) {
  const { t } = useTranslation('characters')

  return (
    <>
      <p className="font-serif text-[0.9375rem] leading-relaxed text-muted">
        {t('creation.dice.intro')}
      </p>

      {/* The results are read out once, in full, rather than die by die. */}
      <p aria-live="polite" className="sr-only">
        {roll ? t('creation.dice.results', { values: roll.values.map(String) }) : ''}
      </p>

      {/* The tray the dice lie in: four d6 a row, the one set aside greyed out, then the total. */}
      <ul
        aria-hidden
        className={`${TRAY} grid grid-cols-1 gap-2.5 p-3.5 lg:grid-cols-2 lg:gap-x-10 lg:px-[26px] lg:py-5`}
      >
        {Array.from({ length: 7 }, (_, index) => (
          <li key={roll ? `${roll.id}-${index}` : index} className="flex items-center gap-2">
            {DICE.map((die) => (
              <Die
                key={die}
                face={roll?.dice[index]?.faces[die] ?? null}
                setAside={roll?.dice[index]?.dropped === die}
                animated={animated}
                ms={FIRST_MS + (index * DICE.length + die) * STAGGER_MS}
              />
            ))}
            <span className="ms-auto min-w-11 text-end font-serif text-xl leading-none font-semibold text-text tabular-nums">
              <small className="me-1.5 font-sans text-xs font-normal text-subtle">=</small>
              {roll?.values[index] ?? t('creation.unknown')}
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={onRoll}
          disabled={rolling}
          aria-busy={rolling}
          className={roll ? SECONDARY_ACTION : PRIMARY_ACTION}
        >
          {roll ? (
            <RotateCw aria-hidden className="size-[18px]" />
          ) : (
            <Dice5 aria-hidden className="size-[18px]" />
          )}
          {rolling
            ? t('creation.dice.rolling')
            : roll
              ? t('creation.dice.reroll')
              : t('creation.dice.roll')}
        </button>
        {roll && <p className="text-xs text-subtle">{t('creation.dice.rerollHint')}</p>}
      </div>
    </>
  )
}

/** An ivory d6, as the table draws its dice (`D6` of `@/components/dice`), here able to roll. */
const TILE =
  'box-content size-[30px] shrink-0 overflow-hidden rounded-md border border-die-line bg-die text-die-ink'
/** A die that counts: its lower edge and a soft shadow on the tray. */
const KEPT = 'shadow-[inset_0_-2px_0_var(--color-die-side),0_2px_3px_rgb(60_45_25/0.2)]'
/** The die set aside: greyed out and dropped a little, it no longer counts. */
const SET_ASIDE = 'translate-y-1 opacity-40 grayscale'

/**
 * One d6: a column of faces that runs past and stops on the face drawn, or
 * stands still on it. Blank before the first roll. The die set aside greys
 * out once it has landed, or stands greyed out.
 */
function Die({
  face,
  setAside,
  animated,
  ms,
}: {
  face: number | null
  setAside: boolean
  animated: boolean
  ms: number
}) {
  if (face === null || !PIPS[face]) {
    return <div className={`${TILE} ${KEPT}`} />
  }

  if (!animated) {
    return (
      <div
        data-set-aside={setAside || undefined}
        className={`${TILE} ${setAside ? SET_ASIDE : KEPT}`}
      >
        <Face value={face} />
      </div>
    )
  }

  const faces = Array.from({ length: TURNS + 1 }, () => FACES).flat()
  const stop = TURNS * FACES.length + FACES.indexOf(face)

  return (
    <div
      data-set-aside={setAside || undefined}
      className={`${TILE} ${setAside ? `${SET_ASIDE} animate-dice-set-aside` : KEPT}`}
      style={setAside ? { animationDelay: `${ms}ms` } : undefined}
    >
      <div
        className="animate-dice-spin"
        style={{ transform: `translateY(-${stop * FACE_REM}rem)`, animationDuration: `${ms}ms` }}
      >
        {faces.map((value, index) => (
          <Face key={index} value={value} />
        ))}
      </div>
    </div>
  )
}

/** A face of a d6, its pips drawn on a 3 × 3 grid. */
function Face({ value }: { value: number }) {
  const pips = PIPS[value] ?? []

  return (
    <div data-face={value} className="grid size-[30px] grid-cols-3 grid-rows-3 p-1">
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className="grid place-items-center">
          {pips.includes(cell) && <span className="size-[5px] rounded-full bg-current" />}
        </span>
      ))}
    </div>
  )
}
