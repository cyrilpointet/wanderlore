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
 * Everything a resolved roll produced.
 *
 * The numeric fields exist for `turn_log`, which records what actually
 * happened. They are not for the narrator — see `NarrationOutcome`.
 */
export type RollResolution = {
  dice: [number, number]
  skillValue: number
  /** `2d6 + skill value`. No modifiers at this phase. */
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
