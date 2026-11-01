import type { TFunction } from 'i18next'

import type { Degree } from '@/api/enums'
import type { Roll } from './queries'

/**
 * A roll in words, in the order of the table: what is rolled and at how
 * much, the difficulty when it is not average, each modifier with its value;
 * then the chance when it moved, the d100 and the degree. Every number comes
 * from the backend: nothing here is computed.
 */
export type RollText = {
  setup: string[]
  chance: string | null
  rolled: string
  degree: string
}

export function rollText(roll: Roll, t: TFunction<'game'>): RollText {
  return {
    setup: [
      roll.skill !== null
        ? t('journal.roll.skill', { name: roll.skill.label, value: roll.value })
        : t('journal.roll.characteristic', {
            name: t(`characteristic.${roll.characteristic!}`, { ns: 'enums' }),
            value: roll.value,
          }),
      ...(roll.difficulty === 'average'
        ? []
        : [t(`difficulty.${roll.difficulty}`, { ns: 'enums' })]),
      ...roll.modifiers.map((modifier) =>
        t('journal.roll.modifier', {
          label:
            modifier.source === 'item'
              ? modifier.item.label
              : t(`contextualEffect.${modifier.effect}`, { ns: 'enums' }),
          value: modifier.value,
        })
      ),
    ],
    chance: roll.chance === roll.value ? null : t('journal.roll.chance', { chance: roll.chance }),
    rolled: t('journal.roll.rolled', { roll: roll.roll }),
    degree: t(`degree.${roll.degree}`, { ns: 'enums' }),
  }
}

/** The whole roll on one line, as the chip shows it. */
export function rollLine(text: RollText): string {
  return [...text.setup, ...(text.chance ? [text.chance] : []), text.rolled, text.degree].join(
    ' · '
  )
}

/** The tint of a roll by its outcome: it doubles the words, never carries the outcome alone. */
export const ROLL_TONE = {
  success: 'border-success/40 bg-success/10 text-success',
  failure: 'border-danger/40 bg-danger/10 text-danger',
}

/** A critical or a fumble stands out; the other degrees read plainly. */
export const DEGREE_EMPHASIS: Record<Degree, string> = {
  critical: 'font-semibold',
  special: '',
  success: '',
  failure: '',
  fumble: 'font-semibold',
}
