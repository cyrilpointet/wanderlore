/**
 * Vocabulary of the resolution engine: the Basic Roleplaying system (rules
 * document, sections 2 to 7), the same for every world.
 *
 * Nothing here is world-specific: which skills exist, their base chances and
 * the values a character has in them are per-world data. Adding a world must
 * never require touching the engine.
 */

/**
 * The seven characteristics of BRP. Fixed by the system, not by a world: the
 * engine's formulas — characteristic rolls, hit points, damage modifier —
 * are written against them.
 */
export const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'INT', 'POW', 'DEX', 'CHA'] as const

export type Characteristic = (typeof CHARACTERISTICS)[number]

/** Every characteristic, with its score. */
export type Characteristics = Record<Characteristic, number>

/**
 * A characteristic roll is the characteristic times this, before difficulty:
 * Effort, Stamina, Idea, Luck, Agility or Charm.
 */
export const CHARACTERISTIC_ROLL_MULTIPLIER = 5

/**
 * What a skill is worth to someone who never trained it: a fixed chance, or
 * a multiple of one of their characteristics (Dodge is DEX × 2).
 */
export type BaseChance = number | { characteristic: Characteristic; multiplier: number }

/**
 * How hard a rolled action is, as arbitration qualifies it. A multiplier of
 * the base chance, applied by the backend (rules, section 4). Certain
 * outcomes — automatic, impossible — are no roll at all.
 */
export const DIFFICULTIES = ['easy', 'average', 'difficult'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

/**
 * The five degrees of a BRP roll (rules, section 6). This — and never a raw
 * number — is what reaches the narration step.
 */
export const DEGREES = ['critical', 'special', 'success', 'failure', 'fumble'] as const

export type Degree = (typeof DEGREES)[number]

export type RollOutcome = 'success' | 'failure'

/**
 * What is rolled: a skill, at the value the roller has in it, or a
 * characteristic, at its score. The value is taken as given — which skills
 * exist and what an untrained one is worth is the caller's business.
 */
export type RollBase =
  | { kind: 'skill'; skill: string; value: number }
  | { kind: 'characteristic'; characteristic: Characteristic; value: number }

/**
 * One modifier counted in a roll, with where it came from: proposed by
 * arbitration for the situation, or read by the backend from an item. Kept
 * apart so the log always tells which side moved the chance.
 */
export type AppliedModifier = {
  source: 'contextual' | 'item'
  /** Stable reference of what the modifier stems from: a circumstance, an item. */
  origin: string
  value: number
}

/**
 * How much a circumstance weighs on a roll, as arbitration qualifies it. A
 * label, never a number: the backend prices it (rules, section 5.1).
 */
export const CONTEXTUAL_EFFECTS = [
  'major_bonus',
  'minor_bonus',
  'minor_penalty',
  'major_penalty',
] as const

export type ContextualEffect = (typeof CONTEXTUAL_EFFECTS)[number]

/** A circumstance of the turn: "favorable_reputation", "unsuitable_attire". */
export type ContextualModifier = {
  source: string
  effect: ContextualEffect
}

/** What an item modifier aims at: a skill a roll tests. */
export type ModifierTarget = { target: 'skill'; skill: string }

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
 * What moves a roll besides the dice and the base: the circumstances
 * arbitration saw, and the items of whoever rolls, read against the skill.
 * A characteristic roll reads no item.
 */
export type RollModifiers = {
  contextual: ContextualModifier[]
  items: ModifierSource[]
}

/**
 * Everything a resolved roll produced.
 *
 * The numeric fields exist for `turn_log`, which records what actually
 * happened, and for the player, who sees the detail of their roll. They are
 * never for the narrator — see `NarrationOutcome`.
 */
export type RollResolution = {
  base: RollBase
  /** The skill value, or the characteristic times five: what difficulty multiplies. */
  baseChance: number
  difficulty: Difficulty
  /**
   * Every modifier counted, with its origin: the circumstances first, then
   * the items. The log always tells which side moved the chance.
   */
  appliedModifiers: AppliedModifier[]
  /** `baseChance` through difficulty, plus every modifier. May fall below 0 or rise past 100. */
  chance: number
  /** The d100, 1 to 100 — 100 is the "00" of the table. */
  roll: number
  result: RollOutcome
  degree: Degree
}

/**
 * The only part of a roll the narration step is ever given.
 *
 * Handing it the dice, the chance or the skill value would have it justify or
 * contradict the numbers instead of telling the story.
 */
export type NarrationOutcome = {
  result: RollOutcome
  degree: Degree
}

/** How much of the attacker's damage modifier a weapon adds: melee, thrown, firearm. */
export const DAMAGE_MODIFIER_USES = ['full', 'half', 'none'] as const

export type DamageModifierUse = (typeof DAMAGE_MODIFIER_USES)[number]

/**
 * The effect a special success with the weapon has. Recorded on the weapon
 * profile from now on; its mechanics come with the combat loop (Phase 9).
 */
export const SPECIAL_EFFECTS = [
  'bleeding',
  'crushing',
  'entangling',
  'impaling',
  'knockback',
] as const

export type SpecialEffect = (typeof SPECIAL_EFFECTS)[number]

/** A hit as the damage formula needs it. */
export type DamageRequest = {
  /** The weapon's dice: `1D6+1` for a rapier, `1D3` bare-handed. */
  weaponDamage: string
  /** The attacker's damage modifier, from their STR + SIZ; null when it has none. */
  damageModifier: string | null
  damageModifierUse: DamageModifierUse
  /** The target's armour value, subtracted from every hit but a critical one. */
  armor: number
  critical: boolean
}

/** The damage a hit deals, part by part, for the log. */
export type DamageResolution = {
  weapon: number
  modifier: number
  /** What the armour actually stopped: nothing on a critical. */
  armor: number
  total: number
}
