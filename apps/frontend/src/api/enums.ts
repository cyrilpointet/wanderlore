/**
 * The closed enums the backend sends. They are system values, finite and known
 * at compile time: the front owns their labels, in the `enums` translation
 * namespace (front spec, principle 2). Content references (skills, locations…)
 * are not here — their labels come from the backend.
 */
export const GAME_STATUSES = ['in_progress', 'paused', 'completed'] as const
export const TURN_STATUSES = ['pending', 'completed', 'failed'] as const
export const STEPS = ['arbitration', 'narration'] as const
export const RESULTS = ['success', 'failure'] as const
/** The five degrees of a BRP roll. */
export const DEGREES = ['critical', 'special', 'success', 'failure', 'fumble'] as const
export const DIFFICULTIES = ['easy', 'average', 'difficult'] as const
/** How much a circumstance weighs on a roll: what the player is shown of it. */
export const CONTEXTUAL_EFFECTS = [
  'major_bonus',
  'minor_bonus',
  'minor_penalty',
  'major_penalty',
] as const
/** The seven characteristics of BRP, the same in every world. */
export const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'INT', 'POW', 'DEX', 'CHA'] as const
/** The six skill categories of BRP: how the sheet groups a world's skills. */
export const SKILL_CATEGORIES = [
  'combat',
  'communication',
  'manipulation',
  'mental',
  'perception',
  'physical',
] as const

/** What happened to one of the character's items during a turn. */
export const ITEM_CHANGES = ['gained', 'lost', 'used_up', 'equipped', 'unequipped'] as const

/** Only a game master sees drafts, to try them out before publishing. */
export const SCENARIO_STATUSES = ['draft', 'published'] as const

export type GameStatus = (typeof GAME_STATUSES)[number]
export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number]
export type TurnStatus = (typeof TURN_STATUSES)[number]
export type Step = (typeof STEPS)[number]
export type Result = (typeof RESULTS)[number]
export type Degree = (typeof DEGREES)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type ContextualEffect = (typeof CONTEXTUAL_EFFECTS)[number]
export type Characteristic = (typeof CHARACTERISTICS)[number]
export type SkillCategory = (typeof SKILL_CATEGORIES)[number]
export type ItemChange = (typeof ITEM_CHANGES)[number]
