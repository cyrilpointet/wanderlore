import type { TFunction } from 'i18next'

import type { Damage, Opponent, Roll } from './queries'

/**
 * A roll in words, in the order of the table: in combat, the attack or the
 * defence and against whom; what
 * is rolled and at how much, the difficulty when it is not average, each
 * modifier with its value; then the chance when it moved, the d100 and the
 * degree. In combat, what it did — an attack's outcome and, when it hit, the
 * damage it dealt in full; a defence's, whether it held. Every number comes
 * from the backend: nothing here is computed.
 */
export type RollText = {
  /** In combat: "Attack on…", "Parry against…". */
  heading: string | null
  setup: string[]
  chance: string | null
  rolled: string
  degree: string
  outcome: string | null
  /** Empty unless the character's blow hit. */
  damage: string[]
}

export function rollText(roll: Roll, t: TFunction<'game'>): RollText {
  const { combat } = roll

  return {
    heading:
      combat === null
        ? null
        : combat.role === 'attack'
          ? t('journal.roll.attackOn', { opponent: opponentName(combat.opponent, t) })
          : t('journal.roll.defenseAgainst', {
              defense: t(`defense.${combat.defense}`, { ns: 'enums' }),
              opponent: opponentName(combat.opponent, t),
            }),
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
    outcome:
      combat === null
        ? null
        : combat.role === 'attack'
          ? t(`attackOutcome.${combat.outcome}`, { ns: 'enums' })
          : t(`defenseOutcome.${combat.outcome}`, { ns: 'enums' }),
    damage: combat?.role === 'attack' && combat.damage ? damageText(combat.damage, t) : [],
  }
}

/** By name when the character knows it, else the n-th unknown opponent. */
function opponentName(opponent: Opponent, t: TFunction<'game'>): string {
  return opponent.label ?? t('journal.roll.unknownOpponent', { rank: opponent.rank })
}

/**
 * The damage dealt, as it adds up: the weapon's dice, the damage modifier and
 * the armour when they weigh, the total and the special effect.
 */
function damageText(damage: Damage, t: TFunction<'game'>): string[] {
  return [
    t('journal.roll.damage.weapon', { value: damage.weapon }),
    ...(damage.modifier === 0
      ? []
      : [t('journal.roll.damage.modifier', { value: damage.modifier })]),
    ...(damage.armor === 0 ? [] : [t('journal.roll.damage.armor', { value: damage.armor })]),
    t('journal.roll.damage.total', { total: damage.total }),
    ...(damage.effect ? [t(`specialEffect.${damage.effect}`, { ns: 'enums' })] : []),
  ]
}

/** The roll itself on one line, up to what it did in combat — the damage aside. */
export function rollSummary(text: RollText): string {
  return [
    ...(text.heading ? [text.heading] : []),
    ...text.setup,
    ...(text.chance ? [text.chance] : []),
    text.rolled,
    text.degree,
    ...(text.outcome ? [text.outcome] : []),
  ].join(' · ')
}

/** The damage dealt on one line; empty when there is none. */
export function damageLine(text: RollText): string {
  return text.damage.join(' · ')
}

/** The whole roll on one line, damage included: what is announced once it is revealed. */
export function rollLine(text: RollText): string {
  return [rollSummary(text), ...(text.damage.length > 0 ? [damageLine(text)] : [])].join(' · ')
}

/**
 * The roll as its card reads it: in combat, which roll and against whom; what
 * is rolled at how much, the difficulty, each modifier, the chance when it
 * moved, and the d100. The degree and what it did go on the stamp.
 */
export function cardLine(text: RollText): string[] {
  return [
    ...(text.heading ? [text.heading] : []),
    ...text.setup,
    ...(text.chance ? [text.chance] : []),
    text.rolled,
  ]
}

/** What is stamped on a roll's card: the degree, and in combat what it did. */
export function stampText(text: RollText): string {
  return [text.degree, ...(text.outcome ? [text.outcome] : [])].join(' · ')
}
