/**
 * Vocabulary of the resolution engine.
 *
 * Nothing here is world-specific: the list of skills, their values and any
 * alternative threshold scale are per-world data (Phase 5). Adding a world must
 * never require touching the engine.
 */

/** Standard difficulty scale. A world may later ship its own thresholds. */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'very_hard'

/**
 * Qualitative reading of the margin. This — and never a raw number — is what
 * reaches the narration step: the mechanics stay out of the diegetic text.
 */
export type MarginLabel =
  'critical_success' | 'comfortable' | 'narrow' | 'minor_failure' | 'critical_failure'

export type RollOutcome = 'success' | 'failure'

/**
 * One modifier counted in a roll, with where it came from: proposed by
 * arbitration for the situation, or read by the backend from an item. Kept
 * apart so the log always tells which side moved the total.
 */
export type AppliedModifier = {
  source: 'contextual' | 'item'
  /** Stable reference of what the modifier stems from: a circumstance, an item. */
  origin: string
  value: number
}

/** What an item modifier aims at: a skill a roll tests, or the damage a hit deals. */
export type ModifierTarget = { target: 'skill'; skill: string } | { target: 'damage' }

/**
 * An item as the rules read it: the reference of its definition, whether its
 * holder has it equipped, and the fixed modifiers the definition declares.
 * No label, no holder: the engine knows nothing of worlds or games.
 */
export type ModifierSource = {
  reference: string
  equipped: boolean
  modifiers: (ModifierTarget & { value: number; condition: 'owned' | 'equipped' })[]
}

/**
 * The damage a hit deals: half the margin, rounded up, at least one, plus
 * the bonus of the weapon — itself an item modifier aimed at damage.
 */
export type DamageResolution = {
  hit: number
  appliedModifiers: AppliedModifier[]
  total: number
}

/**
 * Everything a resolved roll produced.
 *
 * The numeric fields exist for `turn_log`, which records what actually
 * happened. They are not for the narrator — see `NarrationOutcome`.
 */
export type RollResolution = {
  dice: [number, number]
  skillValue: number
  /**
   * Every modifier counted, with its origin. Empty until Phase 4 brings item
   * and contextual modifiers; posted now so the log of a roll already has
   * its full shape.
   */
  appliedModifiers: AppliedModifier[]
  /** `2d6 + skill value + modifiers`. */
  total: number
  difficulty: Difficulty
  threshold: number
  /** `total - threshold`, signed. */
  margin: number
  result: RollOutcome
  marginLabel: MarginLabel
}

/**
 * The only part of a roll the narration step is ever given.
 *
 * Handing it the dice, the threshold or the skill value would have it justify
 * or contradict the numbers instead of telling the story.
 */
export type NarrationOutcome = {
  result: RollOutcome
  margin: MarginLabel
}
