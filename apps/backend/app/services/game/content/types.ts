/**
 * Game content as it is stored: a world, its scenarios, and the catalogues of
 * people, places and items they define.
 *
 * Flat on purpose, column for column with the content tables, so the
 * database, the seeder and the back-office all speak the same shape. The turn
 * reads a resolved `WorldDefinition` instead (`#services/game/world`), built
 * from one world and one scenario by `resolveWorld`.
 *
 * Everything is in English except the names in `labels`: the model reads
 * references and descriptions, the player reads labels.
 *
 * The rules are BRP's for every world: the seven characteristics belong to
 * the system, not to a world; a world brings its skills, each with a category
 * and the chance a character who never trained it has.
 */

import type {
  BaseChance,
  Characteristic,
  Characteristics,
  DamageModifierUse,
  SpecialEffect,
} from '#services/rules/types'

export {
  CHARACTERISTICS,
  DAMAGE_MODIFIER_USES,
  SPECIAL_EFFECTS,
  type BaseChance,
  type Characteristic,
  type Characteristics,
  type DamageModifierUse,
  type SpecialEffect,
} from '#services/rules/types'

/**
 * Display names by language code. English is required — it is the fallback
 * for any language a name is missing in — and any other language is optional.
 */
export type Labels = { en: string } & { [language: string]: string }

/** A stable English reference and the names the player reads it by. */
export type LabelledEntry = {
  reference: string
  labels: Labels
}

/** The six skill categories of BRP: a closed enum of the system, to group a sheet by. */
export const SKILL_CATEGORIES = [
  'combat',
  'communication',
  'manipulation',
  'mental',
  'perception',
  'physical',
] as const

export type SkillCategory = (typeof SKILL_CATEGORIES)[number]

export type SkillEntry = LabelledEntry & {
  category: SkillCategory
  /** What a character who never trained the skill has in it. */
  baseChance: BaseChance
}

/**
 * A proper name that is no entity of the game — a faction, a historical
 * figure off stage — and its translations. People and places carry their own
 * names in their definitions.
 */
export type GlossaryEntry = LabelledEntry

/**
 * What resolves a category of action: a world skill, or a characteristic
 * rolled at five times its score. A row of `resolution_rules`, which holds
 * exactly one of the two.
 */
export type ActionTypeContent = {
  /** Stable English reference arbitration picks from a closed list. */
  actionType: string
  /** One sentence on what the category covers, for arbitration. */
  description: string
} & (
  | { associatedSkill: string; associatedCharacteristic: null }
  | { associatedSkill: null; associatedCharacteristic: Characteristic }
)

export const DEFINITION_KINDS = ['unique', 'archetype'] as const

/** `unique`: one instance per game at most. `archetype`: as many as the story needs. */
export type DefinitionKind = (typeof DEFINITION_KINDS)[number]

/** Qualitative only: the model proposes one of these, never a number. */
export const NPC_DISPOSITIONS = ['hostile', 'unfriendly', 'neutral', 'friendly', 'allied'] as const

export type NpcDisposition = (typeof NPC_DISPOSITIONS)[number]

/**
 * What a person brings to a fight, in the same shape as a character's sheet,
 * so one engine resolves everyone. Never sent to the model.
 */
export type CombatProfile = {
  /** Skill values in percent, by reference. */
  skills: Record<string, number>
  hitPointsMax: number
  /**
   * The ordinary weapon they fight with: an item definition carrying a weapon
   * profile, not an item they hold — it cannot be taken from them. A special
   * weapon is held, as an item, and outranks it once fights are wired (Phase 9).
   */
  weapon: string | null
}

export const ITEM_CONDITIONS = ['owned', 'equipped'] as const

/**
 * When an item modifier applies: as soon as the item is held (`owned`), or
 * only while the character wears or wields it (`equipped`).
 */
export type ItemCondition = (typeof ITEM_CONDITIONS)[number]

/**
 * A fixed bonus or malus an item brings to its holder's rolls with a skill,
 * in percent. Read by the backend only: the model never sees it, proposes it
 * or prices it.
 */
export type ItemModifier = {
  target: 'skill'
  skill: string
  value: number
  condition: ItemCondition
  /** English, for audit: why the modifier applies. Never shown, never translated. */
  description: string
}

/**
 * What a weapon deals when it hits, as BRP writes it. Read by the backend
 * only; wired into the turn with the combat loop (Phase 9).
 */
export type WeaponProfile = {
  /** Reference of the world skill the weapon is wielded with. */
  skill: string
  /** A dice expression: `1D6+1` for a rapier. */
  damage: string
  /** How much of the wielder's damage modifier it adds: melee, thrown, firearm. */
  damageModifier: DamageModifierUse
  /** What a special success with it does. Recorded, without effect before Phase 9. */
  special: SpecialEffect | null
}

/**
 * Who holds a unique item when the game starts, if anyone: it comes into
 * being with that character or place, the first time the game meets them.
 */
export type ItemHolderReference =
  { holder: 'npc'; reference: string } | { holder: 'location'; reference: string }

type DefinitionContent = LabelledEntry & {
  /** One line of English for the model, never shown to the player. */
  description: string
  kind: DefinitionKind
}

/**
 * A person of the world. The improvised passer-by is an instance of a
 * `generic` archetype; a unique is never generic.
 */
export type NpcDefinitionContent = DefinitionContent & {
  generic: boolean
  defaultDisposition: NpcDisposition
  combat: CombatProfile
}

/**
 * A place of the world. A unique place declares the unique place that
 * contains it, if any; an archetype gets its parent per instance, so has none
 * here. Every archetype serves improvised places.
 */
export type LocationDefinitionContent = DefinitionContent & {
  parent: string | null
}

/**
 * An item of the world. Only an archetype may be `generic` (it stands for
 * whatever the player improvises) or `stackable` (interchangeable, counted by
 * quantity); only a unique may have an initial holder.
 */
export type ItemDefinitionContent = DefinitionContent & {
  generic: boolean
  stackable: boolean
  equippable: boolean
  modifiers: ItemModifier[]
  /** Null for anything that is no weapon. */
  weapon: WeaponProfile | null
  initialHolder: ItemHolderReference | null
}

/** The three catalogues, as a world or a scenario declares them. */
export type Catalogues = {
  npcs: NpcDefinitionContent[]
  locations: LocationDefinitionContent[]
  items: ItemDefinitionContent[]
}

/** A quest as a game carries it: where it stands, and what it asks, in English. */
export type ActiveQuest = {
  reference: string
  step: number
  summary: string
}

/** An item the pregenerated character starts with. */
export type StartingItem = {
  definition: string
  /** Short English description, for the narrator only. */
  descriptor: string | null
  quantity: number
  equipped: boolean
}

/**
 * The character a scenario is played with, copied into every game started
 * from it. Guided creation comes in Phase 9.
 */
export type PregeneratedCharacter = {
  name: string
  characteristics: Characteristics
  /**
   * Skill values in percent, for the skills the character trained. Any other
   * skill of the world is worth its base chance. Hit points are no field:
   * they derive from CON and SIZ.
   */
  skills: Record<string, number>
  resources: Record<string, number>
  items: StartingItem[]
}

/** Where a game started from a scenario stands before its first turn. */
export type InitialState = {
  /** Reference of a unique location of the world. */
  location: string
  chapter: string | null
  quests: ActiveQuest[]
}

export const SCENARIO_STATUSES = ['draft', 'published'] as const

export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number]

export type ScenarioContent = Catalogues & {
  reference: string
  labels: Labels
  synopsis: string
  status: ScenarioStatus
  chapters: LabelledEntry[]
  quests: LabelledEntry[]
  /** Null until the game master writes them: a draft may lack both. */
  pregeneratedCharacter: PregeneratedCharacter | null
  initialState: InitialState | null
  glossary: GlossaryEntry[]
}

export type WorldContent = Catalogues & {
  reference: string
  labels: Labels
  /** One line, handed to both arbitration and narration so they agree on register. */
  narrativeTone: string
  /** Facts that constrain what is possible. Arbitration only. */
  rules: string[]
  /** Sensory material for the narrator. Never sent to arbitration. */
  ambiance: string[]
  skills: SkillEntry[]
  resources: LabelledEntry[]
  glossary: GlossaryEntry[]
  actionTypes: ActionTypeContent[]
  scenarios: ScenarioContent[]
}
