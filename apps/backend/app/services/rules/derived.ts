import type { BaseChance, Characteristics } from './types.js'

/**
 * Values BRP derives from a character's characteristics (rules, sections 3
 * and 7). Computed by the backend whenever they are needed, never written by
 * hand — a pregenerated character has no hit points of its own to get wrong.
 */

/** Hit points: half of CON + SIZ, rounded up — a dozen for an ordinary adult. */
export function hitPointsFor(characteristics: Characteristics): number {
  return Math.ceil((characteristics.CON + characteristics.SIZ) / 2)
}

/**
 * What a skill is worth untrained: its fixed base chance, or a multiple of a
 * characteristic.
 */
export function baseChanceOf(base: BaseChance, characteristics: Characteristics): number {
  return typeof base === 'number' ? base : characteristics[base.characteristic] * base.multiplier
}

/**
 * The damage modifier table of BRP, by STR + SIZ: the dice a strong, heavy
 * attacker adds to every blow, or takes away from a slight one. Null between
 * 17 and 24, where it is none at all.
 */
export function damageModifierFor(characteristics: Characteristics): string | null {
  const total = characteristics.STR + characteristics.SIZ

  if (total <= 12) return '-1D6'
  if (total <= 16) return '-1D4'
  if (total <= 24) return null
  if (total <= 32) return '+1D4'
  if (total <= 40) return '+1D6'

  /** From 41 on, one more D6 for every further 16 points. */
  return `+${2 + Math.floor((total - 41) / 16)}D6`
}
