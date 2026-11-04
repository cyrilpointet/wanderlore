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
  DamageModifierUse,
  PowerLevel,
  SpecialEffect,
  WeaponKind,
} from '#services/rules/types'
import type { FixedDuration, Period } from '#services/game/game_time'

export {
  CHARACTERISTICS,
  DAMAGE_MODIFIER_USES,
  POWER_LEVELS,
  SPECIAL_EFFECTS,
  WEAPON_KINDS,
  type BaseChance,
  type Characteristic,
  type Characteristics,
  type DamageModifierUse,
  type PowerLevel,
  type SpecialEffect,
  type WeaponKind,
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
   * profile, not an item they hold — it cannot be taken from them. A weapon
   * they hold, as an item, outranks it.
   */
  weapon: string | null
  /**
   * Their damage modifier, as the book's creature sheets give it (`+1D4`);
   * null for none. Entered, never derived: a person has no characteristics.
   */
  damageModifier: string | null
  /** Their ordinary armour, subtracted from every blow; an armour they hold and wear outranks it. */
  armor: number
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
 * only. No skill: the category of action an attack is classed in names the
 * skill it is made with (roadmap, Phase 10).
 */
export type WeaponProfile = {
  /** Wielded in hand, thrown, or a projectile: what a riposte is, and how it is met. */
  kind: WeaponKind
  /** A dice expression: `1D6+1` for a rapier. */
  damage: string
  /** How much of the wielder's damage modifier it adds: melee, thrown, firearm. */
  damageModifier: DamageModifierUse
  /** What a special success with it does. */
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
  /**
   * Reference of the unique place a unique person waits in when the game
   * starts, if any: they come into being there, the first time the game
   * visits it — as an item does with its initial holder. An archetype has
   * none.
   */
  initialLocation: string | null
  /**
   * Where a unique person is through the day, period by period (roadmap,
   * Phase 11); empty for none, and always for an archetype. A period no entry
   * covers leaves them where they are.
   */
  schedule: ScheduleEntry[]
}

/**
 * Where a unique person goes at some periods of the day, and what they do
 * there. Each period belongs to one entry at most.
 */
export type ScheduleEntry = {
  periods: Period[]
  /** Reference of a unique place. */
  location: string
  /** One line of English for the narrator, when they are in the scene: "reviews his guards". */
  activity: string | null
  /** They keep to it even in the scene with the character: the vampire flees the dawn. */
  leavesScene: boolean
  /** Their arrival where the character is cuts a long action short. */
  interrupts: boolean
}

/** What a place is like at some periods of the day, added to its description. */
export type PeriodNote = {
  periods: Period[]
  /** One line of English: "at night, a single sentry watches the gate". */
  note: string
}

/**
 * A way out of a unique place into another (roadmap, Phase 7). Declared once,
 * on one side, it leads both ways unless it is one-way: the place it leads to
 * has it too, read from the other side.
 */
export type LocationExit = {
  /** Reference of the unique place it leads to. */
  to: string
  /**
   * One line of English for the model: the passage, seen from this side.
   * It never names what lies beyond — "a heavy door beside the stairs", not
   * "the library door": the character learns what a room is by going in.
   */
  passage: string
  /**
   * The same passage seen from the other side; null when the text reads both
   * ways. It never names where it comes from either: a place may be entered
   * by more than one way, and the character may know only one of them.
   */
  backPassage: string | null
  /** Hidden from this side only: seen from the other side, it is always in sight. */
  hidden: boolean
  /** Reference of the item that opens it, from either side. */
  requires: string | null
  oneWay: boolean
  /** How long going through takes, from the scale of durations; null is a moment. */
  duration: FixedDuration | null
  /**
   * The periods it cannot be gone through at all, from either side: the sea
   * fills the cave mouth. No key, no skill opens it. Absent from an exit
   * written before Phase 11.
   */
  blockedDuring?: Period[]
  /** One line of English on why, seen from either side; null when nothing needs saying. */
  blockedReason?: string | null
}

/**
 * A place of the world. A unique place declares the unique place that
 * contains it, if any; an archetype gets its parent per instance, so has none
 * here. Every archetype serves improvised places.
 *
 * A unique place with exits is part of a network, gone through by its exits
 * only; an `entrance` is where a network opens onto the places travelled to
 * freely. An archetype has neither.
 */
export type LocationDefinitionContent = DefinitionContent & {
  parent: string | null
  exits: LocationExit[]
  entrance: boolean
  periodNotes: PeriodNote[]
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
  /**
   * What it stops of every blow while its holder wears it — equippable items
   * only; 0 for anything that is no armour. Several worn: the best counts.
   */
  armor: number
  initialHolder: ItemHolderReference | null
}

/**
 * Which step a lore fragment goes to: `rule` to arbitration (what is
 * plausible), `ambiance` to the narration (what is seen, heard, smelt),
 * `fact` to both.
 */
export const LORE_FRAGMENT_KINDS = ['rule', 'ambiance', 'fact'] as const

export type LoreFragmentKind = (typeof LORE_FRAGMENT_KINDS)[number]

/**
 * What the world or the scenario tells the model beyond what it knows
 * natively (roadmap, Phase 8). Sent only to the steps its kind serves, and
 * only when the scene holds one of its tags — none: always.
 *
 * No names: a fragment is English for the model, never shown nor translated.
 * One that reaches the narration names no unique person and nothing behind a
 * passage, as a description of a place would not.
 */
export type LoreFragmentContent = {
  reference: string
  kind: LoreFragmentKind
  content: string
  /** References of places, people or items: the scene holding one sends it. */
  tags: string[]
  /** Arbitration only: the story knows it, the narrator must not tell it. Never an ambiance. */
  secret: boolean
}

/**
 * The catalogues, as a world or a scenario declares them: people, places and
 * items, and the lore.
 */
export type Catalogues = {
  npcs: NpcDefinitionContent[]
  locations: LocationDefinitionContent[]
  items: ItemDefinitionContent[]
  lore: LoreFragmentContent[]
}

/** A quest as a game carries it: where it stands, and what it asks, in English. */
export type ActiveQuest = {
  reference: string
  step: number
  summary: string
}

/** An item a character starts a game with, from their profession or from the scenario. */
export type StartingItem = {
  definition: string
  /** Short English description, for the narrator only. */
  descriptor: string | null
  quantity: number
  equipped: boolean
}

/**
 * What a scenario gives the character as a game starts (roadmap, Phase 12),
 * on top of their profession's equipment: the letter for Tréville, the keys
 * of the house. Its resources add to the profession's.
 */
export type StartingKit = {
  items: StartingItem[]
  resources: Record<string, number>
}

/**
 * A profession of a world, which a player picks for their character
 * (roadmap, Phase 12). No scenario overrides it: one holds for the whole
 * world.
 */
export type ProfessionContent = LabelledEntry & {
  /** One line of English, shown at creation and read by arbitration and the narrator. */
  description: string
  /** References of world skills: the only ones the professional points go to. */
  skills: string[]
  /** Items of the world — never of a single scenario — given at the start of every game. */
  startingItems: StartingItem[]
  /** Values by reference of a world resource, added to the scenario's. */
  startingResources: Record<string, number>
}

/** The genders a player picks from: a closed list, for the narrator's pronouns and agreements. */
export const CHARACTER_GENDERS = ['female', 'male', 'neutral'] as const

export type CharacterGender = (typeof CHARACTER_GENDERS)[number]

/** Where a game started from a scenario stands before its first turn. */
export type InitialState = {
  /** Reference of a unique location of the world. */
  location: string
  chapter: string | null
  quests: ActiveQuest[]
  /**
   * The unique people whose names the character knows from the start: a
   * relative, the person a letter is for. Anyone else is named only once they
   * give their name in play. Absent from a state written before it existed.
   */
  knownNpcs?: string[]
}

/**
 * A notable turn of the story extraction may record, from the scenario's
 * closed list (roadmap, Phase 11): what sets off an event, or what the next
 * steps read of the story.
 */
export type ScenarioFlag = {
  reference: string
  /** One line of English, for extraction: when the narration sets it. */
  description: string
}

/**
 * What the state must hold for an event, read by the backend — never in the
 * text. People and items are unique ones, by reference: an archetype has no
 * single instance to look at.
 */
export type EventCondition =
  | { type: 'flag'; flag: string }
  | { type: 'item_held_by'; item: string; holder: { holder: 'character' } | ItemHolderReference }
  | { type: 'item_gone'; item: string }
  | { type: 'npc_dead'; npc: string }
  | { type: 'npc_disposition'; npc: string; disposition: NpcDisposition }
  | { type: 'npc_at'; npc: string; location: string }
  | { type: 'location_visited'; location: string }

export const EVENT_CONDITION_TYPES = [
  'flag',
  'item_held_by',
  'item_gone',
  'npc_dead',
  'npc_disposition',
  'npc_at',
  'location_visited',
] as const

/**
 * What an event does, applied by the backend through the services of the
 * game — never proposed by the model. A passage is named by the two places
 * it joins, either way round.
 */
export type EventEffect =
  /** A unique person goes to a unique place. */
  | { type: 'npc_moved'; npc: string; location: string }
  /** A unique person goes away, nobody knows where. */
  | { type: 'npc_left'; npc: string }
  /** Someone comes into a unique place: a new person of an archetype, or a unique one. */
  | { type: 'npc_entered'; npc: string; location: string; descriptor: string | null }
  | { type: 'npc_disposition'; npc: string; disposition: NpcDisposition }
  /** A unique person's schedule stops for good: the Cardinal arrested reviews no troops. */
  | { type: 'schedule_stopped'; npc: string }
  | { type: 'passage_blocked'; from: string; to: string }
  | { type: 'passage_cleared'; from: string; to: string }
  | { type: 'passage_discovered'; from: string; to: string }
  | { type: 'passage_unlocked'; from: string; to: string }
  /** One line of English on how a unique place looks now; it replaces any note an event left there. */
  | { type: 'place_note_set'; location: string; note: string }
  | { type: 'place_note_cleared'; location: string }
  /** An item comes into being with someone or somewhere — or a unique one, already about, goes there. */
  | {
      type: 'item_placed'
      item: string
      holder: { holder: 'character' } | ItemHolderReference
      quantity: number
    }
  /** A unique item goes to someone or somewhere, wherever it was. */
  | {
      type: 'item_transferred'
      item: string
      holder: { holder: 'character' } | ItemHolderReference
    }
  /** A unique item is destroyed. */
  | { type: 'item_gone'; item: string }
  | { type: 'flag_set'; flag: string }

export const EVENT_EFFECT_TYPES = [
  'npc_moved',
  'npc_left',
  'npc_entered',
  'npc_disposition',
  'schedule_stopped',
  'passage_blocked',
  'passage_cleared',
  'passage_discovered',
  'passage_unlocked',
  'place_note_set',
  'place_note_cleared',
  'item_placed',
  'item_transferred',
  'item_gone',
  'flag_set',
] as const

/** How long after its conditions first hold an event falls: a fixed span, or days. */
export type EventDelay = { label: FixedDuration } | { label: 'days'; count: number }

/**
 * When a deadline falls: a day of the game, the first being 1, and the start
 * of a period or a time of day on it — midnight when it names neither.
 */
export type EventMoment = {
  day: number
  period: Period | null
  /** `HH:MM`; wins over the period. */
  time: string | null
}

/**
 * Something that happens in the story without the player (roadmap, Phase 11),
 * once at most. A deadline falls at a moment of the clock; an event of the
 * state when the state holds its conditions — at once, or after a delay.
 */
export type ScenarioEvent = {
  reference: string
  when: {
    /** A deadline; with conditions, it falls once they hold, at that moment or after. */
    at: EventMoment | null
    /** All must hold. */
    conditions: EventCondition[]
    /** After the conditions first hold, for an event that is no deadline. */
    delay: EventDelay | null
  }
  /** Checked as it falls due: if any holds, it never happens. */
  unless: EventCondition[]
  /** The unique place it happens in; null when it is felt everywhere — bells, a storm. */
  place: string | null
  /** One line of English for the steps: what happens. */
  description: string
  effects: EventEffect[]
  /** Witnessed, it cuts a long action short: the character wakes up. */
  interrupts: boolean
  /**
   * When the character knows it is coming, and so may wait for it: every
   * condition holds — none, always. Null: never.
   */
  foreseeable: EventCondition[] | null
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
  /** What the scenario gives the character as a game starts, besides their profession's. */
  startingKit: StartingKit
  /** Null until the game master writes it: a draft may lack it. */
  initialState: InitialState | null
  /**
   * When the story opens: a time of day, `HH:MM`, always — and a Gregorian
   * date, `YYYY-MM-DD`, when the story has one. Copied into every game started
   * from the scenario, like the initial state.
   */
  startTime: string
  startDate: string | null
  glossary: GlossaryEntry[]
  /** The closed list of flags extraction may set. */
  flags: ScenarioFlag[]
  events: ScenarioEvent[]
}

export type WorldContent = Catalogues & {
  reference: string
  labels: Labels
  /** One line, handed to both arbitration and narration so they agree on register. */
  narrativeTone: string
  /** The book's level of the world: what its characters are made with. */
  powerLevel: PowerLevel
  skills: SkillEntry[]
  resources: LabelledEntry[]
  glossary: GlossaryEntry[]
  actionTypes: ActionTypeContent[]
  /** What a character of the world may be; a world without one has no character to play. */
  professions: ProfessionContent[]
  scenarios: ScenarioContent[]
}
