import type { DiceService } from '#services/dice'
import type {
  Difficulty,
  MarginLabel,
  NarrationOutcome,
  RollOutcome,
  RollResolution,
} from './types.js'

/**
 * Default threshold scale, section 4 of the rules document.
 *
 * With a 2d6 between 2 and 12 and a skill between 0 and 5, these stay reachable
 * without being trivial. A world may later ship its own scale as data — the
 * comparison logic below does not change with it.
 */
const THRESHOLDS: Record<Difficulty, number> = {
  easy: 7,
  medium: 9,
  hard: 11,
  very_hard: 13,
}

export function thresholdFor(difficulty: Difficulty): number {
  return THRESHOLDS[difficulty]
}

/**
 * Turns a signed margin into its qualitative reading, section 6 of the rules
 * document.
 *
 * A margin of exactly 0 is a success — scraped through, hence `narrow`.
 */
export function qualifyMargin(margin: number): MarginLabel {
  if (margin >= 5) {
    return 'critical_success'
  }

  if (margin >= 1) {
    return 'comfortable'
  }

  if (margin === 0) {
    return 'narrow'
  }

  if (margin >= -3) {
    return 'minor_failure'
  }

  return 'critical_failure'
}

export function outcomeFor(margin: number): RollOutcome {
  return margin >= 0 ? 'success' : 'failure'
}

/**
 * Deterministic resolution of a single roll.
 *
 * Everything the LLM is allowed to influence stops at the arbitration step: it
 * proposes a skill and a difficulty, the backend computes the rest.
 *
 * Phase 1 knows a single kind of roll and **no modifier at all** — neither
 * contextual nor from equipment. Those arrive in Phase 4 and belong in the sum
 * below, not in the caller.
 */
export class RulesEngine {
  #dice: DiceService

  constructor(dice: DiceService) {
    this.#dice = dice
  }

  /**
   * The skill value is taken as given: which skills exist and what they may be
   * worth is per-world data validated at character creation, not here.
   */
  resolve(skillValue: number, difficulty: Difficulty): RollResolution {
    const roll = this.#dice.roll2d6()
    const threshold = thresholdFor(difficulty)
    const total = roll.total + skillValue
    const margin = total - threshold

    return {
      dice: roll.dice,
      skillValue,
      total,
      difficulty,
      threshold,
      margin,
      result: outcomeFor(margin),
      marginLabel: qualifyMargin(margin),
    }
  }
}

/**
 * Strips a resolution down to what the narration step may see.
 *
 * Kept next to the engine so the boundary is visible from the place that owns
 * the numbers, rather than trusted to each caller.
 */
export function toNarrationOutcome(resolution: RollResolution): NarrationOutcome {
  return {
    result: resolution.result,
    margin: resolution.marginLabel,
  }
}
