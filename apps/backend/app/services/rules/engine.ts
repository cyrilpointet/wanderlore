import type { DiceService } from '#services/dice'
import { maximumOf, parseDice, rollExpression } from './dice_expression.js'
import { itemModifiers } from './modifiers.js'
import {
  CHARACTERISTIC_ROLL_MULTIPLIER,
  type AppliedModifier,
  type ContextualEffect,
  type ContextualModifier,
  type DamageRequest,
  type DamageResolution,
  type Degree,
  type Difficulty,
  type NarrationOutcome,
  type RollBase,
  type RollModifiers,
  type RollOutcome,
  type RollResolution,
} from './types.js'

/**
 * Difficulty multiplies the base chance, and only the base: modifiers are
 * added afterwards, never doubled or halved (rules, sections 2 and 4).
 * Halving rounds up, as everywhere in BRP.
 */
export function applyDifficulty(baseChance: number, difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return baseChance * 2
    case 'average':
      return baseChance
    case 'difficult':
      return Math.ceil(baseChance / 2)
  }
}

/** What difficulty multiplies: the skill value, or the characteristic times five. */
export function baseChanceOf(base: RollBase): number {
  return base.kind === 'skill' ? base.value : base.value * CHARACTERISTIC_ROLL_MULTIPLIER
}

/**
 * What a circumstance is worth, section 5.1 of the rules document. Fixed here,
 * so the same circumstance weighs the same from one turn to the next.
 *
 * Smaller than the ±20 / ±50 of the book on purpose: the extreme cases go
 * through difficulty, and three labels can move a chance by 60 points at
 * most.
 */
const CONTEXTUAL_VALUES: Record<ContextualEffect, number> = {
  major_bonus: 20,
  minor_bonus: 10,
  minor_penalty: -10,
  major_penalty: -20,
}

/**
 * More would let arbitration decide the outcome by itself. The arbitration
 * output is checked against it first; this is the last guard.
 */
export const MAX_CONTEXTUAL_MODIFIERS = 3

export function contextualValue(effect: ContextualEffect): number {
  return CONTEXTUAL_VALUES[effect]
}

/** 01 to 05 always succeeds, 96 to 00 always fails, whatever the chance. */
const ALWAYS_SUCCEEDS = 5
const ALWAYS_FAILS = 96

/**
 * The degree of a d100 roll against a chance (rules, section 6): critical at
 * a twentieth of the chance, special at a fifth, both rounded up; a fumble in
 * the top twentieth of the failure range, also rounded up — 00 always is one.
 *
 * The success range is read on the chance bounded by 5 and 95. Critical and
 * special read the chance itself, so a chance past 100 widens them, as in the
 * book.
 */
export function degreeOf(roll: number, chance: number): Degree {
  const bounded = Math.min(Math.max(chance, ALWAYS_SUCCEEDS), ALWAYS_FAILS - 1)
  const reach = Math.max(chance, ALWAYS_SUCCEEDS)

  if (roll <= Math.min(Math.ceil(reach / 20), bounded)) return 'critical'
  if (roll <= Math.min(Math.ceil(reach / 5), bounded)) return 'special'
  if (roll <= bounded) return 'success'

  const fumbles = Math.ceil((100 - bounded) / 20)

  return roll > 100 - fumbles ? 'fumble' : 'failure'
}

export function outcomeOf(degree: Degree): RollOutcome {
  return degree === 'failure' || degree === 'fumble' ? 'failure' : 'success'
}

const NO_MODIFIERS: RollModifiers = { contextual: [], items: [] }

/**
 * Deterministic resolution of a single roll, and of the damage of a hit.
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
   * The base value is taken as given: which skills exist, and what one the
   * roller never trained is worth, is per-world data the caller reads.
   */
  resolve(
    base: RollBase,
    difficulty: Difficulty,
    modifiers: RollModifiers = NO_MODIFIERS
  ): RollResolution {
    if (modifiers.contextual.length > MAX_CONTEXTUAL_MODIFIERS) {
      throw new RangeError(
        `${modifiers.contextual.length} contextual modifiers on one roll: ${MAX_CONTEXTUAL_MODIFIERS} at most.`
      )
    }

    /** An item helps with a skill; a raw characteristic roll reads none. */
    const appliedModifiers: AppliedModifier[] = [
      ...modifiers.contextual.map(contextual),
      ...(base.kind === 'skill'
        ? itemModifiers(modifiers.items, { target: 'skill', skill: base.skill })
        : []),
    ]
    const baseChance = baseChanceOf(base)
    const chance =
      applyDifficulty(baseChance, difficulty) +
      appliedModifiers.reduce((sum, { value }) => sum + value, 0)
    const roll = this.#dice.rollD100()
    const degree = degreeOf(roll, chance)

    return {
      base,
      baseChance,
      difficulty,
      appliedModifiers,
      chance,
      roll,
      result: outcomeOf(degree),
      degree,
    }
  }

  /**
   * Damage dealt by a hit (rules, section 7): the weapon's dice plus the
   * attacker's damage modifier — all of it, half of it rounded up when it is
   * a bonus, or none — minus the target's armour, never below zero. A critical
   * hit deals the most the weapon can, rolls the modifier as usual, and goes
   * through armour.
   *
   * Posed now and tested; wiring it into the turn comes with the combat loop.
   */
  resolveDamage(request: DamageRequest): DamageResolution {
    const weaponDice = parseDice(request.weaponDamage)
    const weapon = request.critical ? maximumOf(weaponDice) : rollExpression(this.#dice, weaponDice)

    const rolled =
      request.damageModifier === null || request.damageModifierUse === 'none'
        ? 0
        : rollExpression(this.#dice, parseDice(request.damageModifier))
    const modifier =
      request.damageModifierUse === 'half' && rolled > 0 ? Math.ceil(rolled / 2) : rolled

    const dealt = Math.max(0, weapon + modifier)
    const armor = request.critical ? 0 : Math.min(request.armor, dealt)

    return { weapon, modifier, armor, total: dealt - armor }
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
    degree: resolution.degree,
  }
}
