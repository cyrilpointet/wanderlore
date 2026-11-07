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
  type Defense,
  type Degree,
  type Difficulty,
  type Fumble,
  type HarmResolution,
  type HitDegree,
  type HitRequest,
  type HitResolution,
  type NarrationOutcome,
  type Weapon,
  type WeaponKind,
  type Wound,
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
 * The chance of a roll before the dice: the base through difficulty, then
 * every modifier — what the round compares to pick the better defence.
 */
export function chanceOf(
  base: RollBase,
  difficulty: Difficulty,
  modifiers: RollModifiers = NO_MODIFIERS
): { baseChance: number; appliedModifiers: AppliedModifier[]; chance: number } {
  /** An item helps with a skill; a raw characteristic roll reads none. */
  const appliedModifiers: AppliedModifier[] = [
    ...modifiers.contextual.map(contextual),
    ...(base.kind === 'skill'
      ? itemModifiers(modifiers.items, { target: 'skill', skill: base.skill })
      : []),
  ]
  const baseChance = baseChanceOf(base)

  return {
    baseChance,
    appliedModifiers,
    chance:
      applyDifficulty(baseChance, difficulty) +
      appliedModifiers.reduce((sum, { value }) => sum + value, 0),
  }
}

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

    const { baseChance, appliedModifiers, chance } = chanceOf(base, difficulty, modifiers)
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

  /**
   * The damage of a blow that landed, with its special effect (rules,
   * section 8). A critical deals the weapon at its most through armour, and
   * no effect. A special success brings the weapon's own: an impale doubles
   * the weapon's dice, a crushing blow the damage modifier — none becomes
   * `+1D4`, a malus none at all — and stuns; an entangling or knockback blow
   * keeps the target from striking back; a bleeding one goes on bleeding.
   */
  resolveHit(request: HitRequest): HitResolution {
    const { weapon, degree } = request
    const effect = degree === 'special' ? weapon.special : null

    if (effect === 'impaling' || effect === 'crushing') {
      return {
        ...this.#specialDamage(request, effect),
        degree,
        effect,
        bleeding: false,
        stopped: effect === 'crushing',
      }
    }

    return {
      ...this.resolveDamage({
        weaponDamage: weapon.damage,
        damageModifier: request.damageModifier,
        damageModifierUse: weapon.damageModifier,
        armor: request.armor,
        critical: degree === 'critical',
      }),
      degree,
      effect,
      bleeding: effect === 'bleeding',
      stopped: effect === 'entangling' || effect === 'knockback',
    }
  }

  #specialDamage(request: HitRequest, effect: 'impaling' | 'crushing'): DamageResolution {
    const { weapon } = request
    const weaponDice = parseDice(weapon.damage)
    const weaponRoll =
      effect === 'impaling'
        ? rollExpression(this.#dice, weaponDice) + rollExpression(this.#dice, weaponDice)
        : rollExpression(this.#dice, weaponDice)

    const modifierRoll = (): number => {
      if (weapon.damageModifier === 'none') return 0
      if (effect === 'impaling') {
        return request.damageModifier === null ? 0 : this.#rollModifier(request.damageModifier)
      }
      if (request.damageModifier === null) return this.#rollModifier(CRUSHING_WITHOUT_MODIFIER)
      if (request.damageModifier.startsWith('-')) return 0

      return this.#rollModifier(request.damageModifier) + this.#rollModifier(request.damageModifier)
    }
    const rolled = modifierRoll()
    const modifier = weapon.damageModifier === 'half' && rolled > 0 ? Math.ceil(rolled / 2) : rolled

    const dealt = Math.max(0, weaponRoll + modifier)
    const armor = Math.min(request.armor, dealt)

    return { weapon: weaponRoll, modifier, armor, total: dealt - armor }
  }

  #rollModifier(expression: string): number {
    return rollExpression(this.#dice, parseDice(expression))
  }

  /**
   * What a fumble does, on the reduced table: an outcome that does not apply
   * — no weapon to drop, one that cannot break — is nothing more than the
   * failure itself.
   */
  rollFumble(weapon: { droppable: boolean; breakable: boolean }): Fumble {
    const fumble = fumbleOf(this.#dice.rollD100())

    if (fumble === 'weapon_dropped' && !weapon.droppable) return 'nothing'
    if (fumble === 'weapon_broken' && !weapon.breakable) return 'nothing'

    return fumble
  }

  /**
   * One of several, each as likely: who strikes back among those who can. A
   * single one is no draw — no die is rolled for them.
   */
  pickOne<T>(candidates: T[]): T {
    if (candidates.length === 0) {
      throw new RangeError('There is no one to pick among.')
    }

    return candidates.length === 1
      ? candidates[0]
      : candidates[this.#dice.rollDie(candidates.length) - 1]
  }

  /** A fumbler's own blow: the weapon's dice, without the modifier, less their armour. */
  selfInjury(weapon: Weapon, armor: number): number {
    return Math.max(0, this.#rollModifier(weapon.damage) - armor)
  }

  /**
   * A harm of the story, as the author wrote it — `12D6`, `6`, `2D4+8` —
   * rolled as it is, less the armour worn, never below zero. No damage
   * modifier and no critical: nobody struck the blow.
   */
  harm(damage: string, armor: number): HarmResolution {
    const rolled = Math.max(0, this.#rollModifier(damage))
    const stopped = Math.min(armor, rolled)

    return { rolled, armor: stopped, total: rolled - stopped }
  }

  /**
   * What first aid does, by its degree (rules, section 8bis): a fumble hurts
   * by one point, a failure does nothing, a success heals 1D3, a special 2D3
   * and a critical 3 + 1D3.
   */
  firstAid(degree: Degree): number {
    switch (degree) {
      case 'fumble':
        return -1
      case 'failure':
        return 0
      case 'success':
        return this.#rollModifier('1D3')
      case 'special':
        return this.#rollModifier('2D3')
      case 'critical':
        return this.#rollModifier('1D3+3')
    }
  }

  /** Natural healing: 1D3 hit points for each week of game time gone by. */
  naturalHealing(weeks: number): number {
    let healed = 0

    for (let week = 0; week < weeks; week += 1) {
      healed += this.#rollModifier('1D3')
    }

    return healed
  }
}

/** What a crushing blow adds when the attacker has no damage modifier of their own. */
const CRUSHING_WITHOUT_MODIFIER = '+1D4'

/** The rank of a successful degree: how many degrees it stands above a failure. */
const SUCCESS_RANK: Record<HitDegree, number> = { success: 1, special: 2, critical: 3 }

function isSuccess(degree: Degree): degree is HitDegree {
  return degree in SUCCESS_RANK
}

/**
 * The attack and defence matrix of BRP (rules, section 8): a defence that
 * fails leaves the attack as it was; one that succeeds takes a degree off it
 * for each degree it stands above a failure, and stops it once nothing is
 * left. A failed attack lands nothing — and is never defended against.
 */
export function hitDegreeOf(attack: Degree, defense: Degree | null): HitDegree | null {
  if (!isSuccess(attack)) {
    return null
  }

  if (defense === null || !isSuccess(defense)) {
    return attack
  }

  const left = SUCCESS_RANK[attack] - SUCCESS_RANK[defense]
  const degrees: HitDegree[] = ['success', 'special', 'critical']

  return left <= 0 ? null : degrees[left - 1]
}

/** A defence the defender may attempt, as the round offers it. */
export type DefenseOption = {
  defense: Defense
  base: RollBase
  difficulty: Difficulty
}

/**
 * The defences possible against a weapon (rules, section 8): parry and dodge
 * against a blow or a thrown weapon; against a projectile, no parry — there
 * is no shield in Wanderlore — and a difficult dodge. `parry` and `dodge`
 * are null when the scene rules them out.
 */
export function defenseOptions(
  against: WeaponKind,
  bases: { parry: RollBase | null; dodge: RollBase | null }
): DefenseOption[] {
  const options: DefenseOption[] = []

  if (bases.parry !== null && against !== 'projectile') {
    options.push({ defense: 'parry', base: bases.parry, difficulty: 'average' })
  }

  if (bases.dodge !== null) {
    options.push({
      defense: 'dodge',
      base: bases.dodge,
      difficulty: against === 'projectile' ? 'difficult' : 'average',
    })
  }

  return options
}

/**
 * The defence the backend rolls: the better chance of those possible — the
 * defender never declared one, and the advantage goes to them. A tie goes
 * to the parry. Null when no defence is possible at all.
 */
export function bestDefense(
  options: DefenseOption[],
  modifiers: RollModifiers = NO_MODIFIERS
): DefenseOption | null {
  let best: { option: DefenseOption; chance: number } | null = null

  for (const option of options) {
    const { chance } = chanceOf(option.base, option.difficulty, modifiers)

    if (best === null || chance > best.chance) {
      best = { option, chance }
    }
  }

  return best?.option ?? null
}

/**
 * How badly a blow hurt, for the narration: mortal once it brings the target
 * to 0 or below, serious when it takes half their hit points or more in one
 * go — the major wound of the book — light otherwise.
 */
export function woundOf(damage: number, hitPointsMax: number, hitPointsAfter: number): Wound {
  if (damage <= 0) return 'none'
  if (hitPointsAfter <= 0) return 'mortal'

  return damage >= Math.ceil(hitPointsMax / 2) ? 'serious' : 'light'
}

/**
 * Down at 2 hit points or fewer: the shock of a serious wound, or light ones
 * piling up — the book knocks both out. Whoever is down strikes no more.
 */
export const DOWN_AT = 2

export function isDown(hitPoints: number): boolean {
  return hitPoints <= DOWN_AT
}

/** The reduced fumble table, on a d100. */
export function fumbleOf(roll: number): Fumble {
  if (roll <= 30) return 'nothing'
  if (roll <= 55) return 'fall'
  if (roll <= 75) return 'weapon_dropped'
  if (roll <= 90) return 'self_injury'

  return 'weapon_broken'
}

/** A week of game time, in seconds: the step natural healing goes by. */
export const HEALING_PERIOD = 7 * 24 * 60 * 60

/** How many whole weeks went by between two readings of the game clock. */
export function healingWeeks(since: number, now: number): number {
  return Math.max(0, Math.floor((now - since) / HEALING_PERIOD))
}

function contextual({ source, effect }: ContextualModifier): AppliedModifier {
  return { source: 'contextual', origin: source, effect, value: contextualValue(effect) }
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
