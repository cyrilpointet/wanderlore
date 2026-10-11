import { itemModifiers } from './modifiers.js'
import type { DamageResolution, ModifierSource } from './types.js'

/**
 * Damage dealt by a hit, without a second roll (rules, section 7): the hit
 * itself — half the margin, rounded up, at least one — plus the weapon's
 * bonus, read from the attacker's items. Bare hands add nothing.
 *
 * Only a hit deals damage: a failed attack is not a hit of zero, it is a
 * question the caller must not ask.
 */
export function resolveDamage(margin: number, attacker: ModifierSource[]): DamageResolution {
  if (!Number.isInteger(margin) || margin < 0) {
    throw new RangeError(`A margin of ${margin} is no hit: only a success deals damage.`)
  }

  const hit = Math.max(1, Math.ceil(margin / 2))
  const appliedModifiers = itemModifiers(attacker, { target: 'damage' })

  return {
    hit,
    appliedModifiers,
    total: hit + appliedModifiers.reduce((sum, modifier) => sum + modifier.value, 0),
  }
}
