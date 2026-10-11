import type { DiceService } from '#services/dice'
import { itemModifiers } from './modifiers.js'
import type {
  AppliedModifier,
  ContextualEffect,
  ContextualModifier,
  Difficulty,
  MarginLabel,
  NarrationOutcome,
  RollModifiers,
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

/**
 * What a circumstance is worth, section 5.1 of the rules document. Fixed here,
 * so the same circumstance weighs the same from one turn to the next.
 */
const CONTEXTUAL_VALUES: Record<ContextualEffect, number> = {
  major_bonus: 2,
  minor_bonus: 1,
  minor_penalty: -1,
  major_penalty: -2,
}

/**
 * More would inflate the score until the difficulty means nothing. The
 * arbitration output is checked against it first; this is the last guard.
 */
export const MAX_CONTEXTUAL_MODIFIERS = 3

export function contextualValue(effect: ContextualEffect): number {
  return CONTEXTUAL_VALUES[effect]
}

const NO_MODIFIERS: RollModifiers = { skill: '', contextual: [], items: [] }

export function outcomeFor(margin: number): RollOutcome {
  return margin >= 0 ? 'success' : 'failure'
}

/**
 * Deterministic resolution of a single roll.
 *
 * Everything the LLM is allowed to influence stops at the arbitration step: it
 * proposes an action type, a difficulty and labelled circumstances; the
 * backend prices the circumstances, reads the item modifiers from what the
 * roller holds, and computes the rest.
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
  resolve(
    skillValue: number,
    difficulty: Difficulty,
    modifiers: RollModifiers = NO_MODIFIERS
  ): RollResolution {
    if (modifiers.contextual.length > MAX_CONTEXTUAL_MODIFIERS) {
      throw new RangeError(
        `${modifiers.contextual.length} contextual modifiers on one roll: ${MAX_CONTEXTUAL_MODIFIERS} at most.`
      )
    }

    const appliedModifiers: AppliedModifier[] = [
      ...modifiers.contextual.map(contextual),
      ...itemModifiers(modifiers.items, { target: 'skill', skill: modifiers.skill }),
    ]
    const roll = this.#dice.roll2d6()
    const threshold = thresholdFor(difficulty)
    const total =
      roll.total + skillValue + appliedModifiers.reduce((sum, { value }) => sum + value, 0)
    const margin = total - threshold

    return {
      dice: roll.dice,
      skillValue,
      appliedModifiers,
      total,
      difficulty,
      threshold,
      margin,
      result: outcomeFor(margin),
      marginLabel: qualifyMargin(margin),
    }
  }
}

function contextual({ source, effect }: ContextualModifier): AppliedModifier {
  return { source: 'contextual', origin: source, value: contextualValue(effect) }
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
