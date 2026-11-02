/**
 * References the backend knows for itself (roadmap, Phase 10): the round, the
 * parry, the riposte and first aid are worked out from them. Like the seven
 * characteristics, they belong to the system — but every world declares them,
 * with its own description, skill and labels: they stay content for anything
 * else.
 */

/** Fighting at close quarters: its skill is the attack in melee, and the parry. */
export const MELEE_COMBAT = 'melee_combat'

/** Shooting or throwing: its skill is the attack at range. */
export const RANGED_COMBAT = 'ranged_combat'

/** Tending a wound: one attempt per wound received, never in the thick of a fight. */
export const FIRST_AID = 'first_aid'

/** The other way to meet a blow, at DEX × 2 untrained in the book. */
export const DODGE = 'dodge'

/** The categories of action every world declares. */
export const SYSTEM_ACTION_TYPES = [MELEE_COMBAT, RANGED_COMBAT, FIRST_AID] as const

/** The categories that attack: both must be resolved by a skill, which a person without characteristics can have. */
export const COMBAT_ACTION_TYPES = [MELEE_COMBAT, RANGED_COMBAT] as const

/** The skills every world declares. */
export const SYSTEM_SKILLS = [DODGE] as const

export function isCombatActionType(actionType: string | null): boolean {
  return actionType === MELEE_COMBAT || actionType === RANGED_COMBAT
}
