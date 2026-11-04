import { Dice5 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PRIMARY_ACTION, SECONDARY_ACTION } from '@/components/actions'
import type { CharacteristicRoll } from '../queries'

/** The faces of a d6. */
const FACES = [1, 2, 3, 4, 5, 6]
/** Two full turns of the faces, then the one the die stops on. */
const TURNS = 2
/** The first die settles after this; each die after it a little later, read one by one. */
const FIRST_MS = 600
const STAGGER_MS = 90
/** The height of a face, in rem: the column is moved by whole faces. */
const FACE_REM = 2.25

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

/**
 * The seven results of 3D6, drawn by the backend and only revealed here: no
 * throw by hand, the draw is not a roll of the game (front spec, section
 * 5.6). Each result shows its three d6, as the backend drew them, and their
 * total, which is what the placement works on.
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
    <div className="flex flex-col items-center gap-6">
      <p className="text-body text-muted">{t('creation.dice.intro')}</p>

      {/* The results are read out once, in full, rather than die by die. */}
      <p aria-live="polite" className="sr-only">
        {roll ? t('creation.dice.results', { values: roll.values.map(String) }) : ''}
      </p>

      <ul aria-hidden className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 7 }, (_, index) => (
          <li
            key={roll ? `${roll.id}-${index}` : index}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface-1 p-3"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map((die) => (
                <Die
                  key={die}
                  face={roll?.dice[index]?.[die] ?? null}
                  animated={animated}
                  ms={FIRST_MS + (index * 3 + die) * STAGGER_MS}
                />
              ))}
            </div>
            <span className="text-xl font-medium text-text tabular-nums">
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

      <button
        type="button"
        onClick={onRoll}
        disabled={rolling}
        aria-busy={rolling}
        className={roll ? SECONDARY_ACTION : PRIMARY_ACTION}
      >
        <Dice5 aria-hidden className="size-4" />
        {rolling
          ? t('creation.dice.rolling')
          : roll
            ? t('creation.dice.reroll')
            : t('creation.dice.roll')}
      </button>
      {roll && <p className="-mt-3 text-label text-subtle">{t('creation.dice.rerollHint')}</p>}
    </div>
  )
}

const TILE =
  'box-content size-9 overflow-hidden rounded-md border border-border-strong bg-surface-2 text-text shadow-[inset_0_-2px_0_var(--color-border)]'

/**
 * One d6: a column of faces that runs past and stops on the face drawn, or
 * stands still on it. Blank before the first roll.
 */
function Die({ face, animated, ms }: { face: number | null; animated: boolean; ms: number }) {
  if (face === null || !PIPS[face]) {
    return <div className={TILE} />
  }

  if (!animated) {
    return (
      <div className={TILE}>
        <Face value={face} />
      </div>
    )
  }

  const faces = Array.from({ length: TURNS + 1 }, () => FACES).flat()
  const stop = TURNS * FACES.length + FACES.indexOf(face)

  return (
    <div className={TILE}>
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
    <div data-face={value} className="grid size-9 grid-cols-3 grid-rows-3 p-1.5">
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className="grid place-items-center">
          {pips.includes(cell) && <span className="size-1.5 rounded-full bg-current" />}
        </span>
      ))}
    </div>
  )
}
