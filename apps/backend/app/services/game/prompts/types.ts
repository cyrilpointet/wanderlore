import type { PlacedLocation } from '#services/game/content_labels'
import type { ContextualModifier, Degree, Difficulty, RollOutcome } from '#services/rules/types'
import type { LoreFragmentContent, NpcDisposition, WorldDefinition } from '#services/game/world'
import type { ActionType } from '#services/game/resolution_rules'
import type { PresentNpc } from '#services/game/npcs'
import type { ItemsInScene } from '#services/game/inventory'
import type { Duration } from '#services/game/game_time'
import type { Route, SceneExit } from '#services/game/travel'
import type { PassageKey } from '#services/game/passages'
import type { NarratedRound } from '#services/game/combat'

/**
 * Shapes exchanged with the model.
 *
 * The payload types use snake_case because they *are* the JSON: renaming keys
 * on the way in or out would only create a second vocabulary to keep in sync.
 *
 * None of this is trusted. The gateway guarantees parsable JSON, never valid
 * JSON — checking these shapes against reality is the validation step's job,
 * before anything reaches the state.
 */

/** BCP-47 tag. Always explicit, never assumed fixed, even while it is only 'en'. */
export type GameLanguage = string

export type ResolutionMode = 'automatic_success' | 'narrative_automatic_failure' | 'roll_required'

export type Plausibility = 'plausible' | 'borderline' | 'impossible'

/**
 * Where the narration took the character: a named place of the world, or a
 * new place of an archetype, set within a named one.
 */
export type Movement =
  | { location: string }
  | { definition: string; parent: string; descriptor: string | null; name: string | null }

/**
 * Who holds an item, as extraction names them: the character, someone
 * present by handle, or the place the turn began in — the only place whose
 * items it was shown.
 */
export type ItemHolderRef =
  { holder: 'character' } | { holder: 'npc'; handle: string } | { holder: 'location' }

/**
 * An item of the scene, as extraction designates it: a copy by its handle, a
 * stack by its definition — told apart by who holds it.
 */
export type ItemOperation = { item: string; quantity: number }

/**
 * The state changes extraction read in the narration, validated against the
 * closed lists — what the backend will apply, not what it applied. Every
 * entity is named by a reference or a handle, never by a name.
 */
export type TurnEffects = {
  movement: Movement | null
  npcs_entered: { definition: string; descriptor: string | null; name: string | null }[]
  npcs_left: string[]
  npcs_following: string[]
  npc_names: { handle: string; name: string }[]
  /** The new disposition itself, never a step up or down. */
  npc_relations: { handle: string; disposition: NpcDisposition }[]
  scenario_flags: string[]
  hit_points_delta: number
  /** Items coming into being, from the closed list of definitions. */
  items_created: {
    definition: string
    descriptor: string | null
    quantity: number
    holder: ItemHolderRef
    /** Drawn or worn at once — the character's, and an equippable item, only. */
    equipped: boolean
  }[]
  /** Items changing hands: taken, given, hidden, dropped, picked up. Never a loss. */
  items_transferred: (ItemOperation & { from: ItemHolderRef; to: ItemHolderRef })[]
  /** Items used up or destroyed. */
  items_destroyed: (ItemOperation & { holder: ItemHolderRef })[]
  /** Handles of the character's copies they draw or wear, or put away. */
  items_equipped: string[]
  items_unequipped: string[]
  /**
   * Exits of the place the scene began in, by the place they lead to: hidden
   * ones the narration shows found, locked ones it shows opened.
   */
  passages_discovered: string[]
  passages_unlocked: string[]
}

/**
 * The place a movement reached, as logged: references and the proper name of
 * an improvised place — never a label, which is worked out when it is read.
 * Enough to label it without reading the instance back.
 */
export type PlacedMovement = {
  handle: string
  definitionReference: string
  parentReference: string | null
  name: string | null
}

/**
 * Who held or now holds an item, as logged: references and the proper name
 * of someone present or of an improvised place — enough to label them later
 * without reading an instance back.
 */
export type AppliedHolder =
  | { holder: 'character' }
  | { holder: 'npc'; handle: string; definitionReference: string; name: string | null }
  | { holder: 'location'; place: PlacedMovement }

/** What happened to items, as applied: handles the backend gave, holders, quantities. */
export type AppliedItems = {
  created: { item: string; definition: string; quantity: number; holder: AppliedHolder }[]
  transferred: {
    item: string
    definition: string
    quantity: number
    from: AppliedHolder
    to: AppliedHolder
  }[]
  destroyed: { item: string; definition: string; quantity: number; holder: AppliedHolder }[]
  equipped: { item: string; definition: string }[]
  unequipped: { item: string; definition: string }[]
}

/**
 * What a turn actually changed. Can be less than proposed — damage stops at
 * zero, a move to where one stands is none, a dead character stays dead. The
 * movement, the hit points and what happened to the character's items are
 * shown to the player; the rest is for the log.
 */
export type AppliedEffects = {
  movement: PlacedMovement | null
  scenario_flags: string[]
  hit_points_delta: number
  /** Handles of those who came in, as the backend numbered them. */
  npcs_entered: string[]
  npcs_left: string[]
  npc_names: { handle: string; name: string }[]
  npc_relations: { handle: string; disposition: NpcDisposition }[]
  /** Absent from turns played before Phase 4. */
  items: AppliedItems
  /**
   * Passages found and opened, as declared: by extraction, or opened on the
   * way with the item they require. Absent from turns played before Phase 7.
   */
  passages?: { discovered: PassageKey[]; unlocked: PassageKey[] }
}

export type ArbitrationOutput = {
  intent: {
    type: string
    target: string | null
    summary: string
    /**
     * Where a movement goes, from the closed list of places the exits reach:
     * the backend times the way there. Null for anything else.
     */
    destination: string | null
  }
  validity: {
    factual: boolean
    plausibility: Plausibility
    justification: string
  }
  resolution: {
    mode: ResolutionMode
    /**
     * From the world's closed list of action types; the backend derives the
     * skill from it. Null unless a roll is required.
     */
    action_type: string | null
    difficulty: Difficulty | null
    /**
     * Circumstances of the turn, as labels the backend prices — never an
     * item, never a number. Empty unless a roll is required.
     */
    contextual_modifiers: ContextualModifier[]
  }
  /**
   * How long the turn takes, as a label the backend converts: the model never
   * writes a time. Ignored for an aside, which takes none — and for a round of
   * combat, which the backend times.
   */
  duration: Duration
  /** Whether the turn is a round of combat, and against whom; null when it is none. */
  combat: CombatEngagement | null
  alert: {
    prompt_injection_suspected: boolean
    out_of_scope: boolean
  }
}

/**
 * A round of combat as arbitration declares it (roadmap, Phase 10): who the
 * character fights, and what the scene allows them against the riposte. The
 * backend checks it, rolls the round and applies it — the model names, never
 * numbers.
 */
export type CombatEngagement = {
  /**
   * Handle of someone present — or, when the character attacks first,
   * reference of an archetype of the world: the improvised passer-by struck
   * before anyone wrote them in.
   */
  opponent: string
  /** The character attacks the opponent; false when they only meet an attack still open. */
  character_attacks: boolean
  /** Whether the character could parry the opponent's blow: a blade in hand, room to move. */
  parry_possible: boolean
  /** Whether they could dodge it: they see it coming and have room to move. */
  dodge_possible: boolean
  /** Circumstances weighing on the character's defence, as labels: three at most. */
  defense_modifiers: ContextualModifier[]
}

export type RecentTurn = {
  role: 'player' | 'narration'
  text: string
}

export type SceneState = {
  /** Handle of the place the game stands in. */
  location: string | null
  /** Who can be acted upon, designated by handle alone. */
  npcs_present: PresentNpc[]
  narrative_flags: Record<string, unknown>
  /** Handles of the places this game has been through, oldest first. */
  visited_locations: string[]
  /** The place as the game holds it, for naming it in the game's language. */
  place: PlacedLocation | null
  /** Definition of each person present, by handle, for naming them. */
  npc_definitions: Record<string, string>
  /** The unique people whose names the character knows. Anyone else unique is named once they give their name. */
  known_npcs: string[]
  /**
   * What the character, the people present and the place hold. Each step is
   * handed its own view of it, never the modifiers.
   */
  items: ItemsInScene
  /** What the place is like, in English: a named place's description, an improvised one's descriptor. */
  place_description: string | null
  /** What an improvised place stands in: the description of its parent. */
  surroundings: string | null
  /** The ways out of the place, with what the game knows of each: none outside a network. */
  exits: SceneExit[]
  /** The places the exits reach, each by its quickest way: none outside a network. */
  routes: Route[]
  /** The game clock as the turn began: seconds since midnight of the first day. */
  game_time: number
  /** The date the game started on, if its story has one. */
  start_date: string | null
}

/**
 * The character as the model sees them. No skill values: arbitration judges
 * the situation, not the character, and the narrator never sees a number.
 */
export type CharacterContext = {
  name: string
  hit_points: number
  hit_points_max: number
}

export type TurnContext = {
  world: WorldDefinition
  character: CharacterContext
  scene: SceneState
  /**
   * What happened before the turns below, in English, oldest first: the
   * latest global summary, then the scene summaries that followed it.
   */
  story_so_far: string[]
  /** Every turn no summary covers yet, oldest first, in the language they were played in. */
  recent_buffer: RecentTurn[]
  player_input: string
  language: GameLanguage
}

/**
 * Arbitration also gets the world's closed list of action types, read from
 * `resolution_rules`, and the lore the scene calls for: rules and facts,
 * secrets included.
 */
export type ArbitrationContext = TurnContext & {
  action_types: ActionType[]
  lore: LoreFragmentContent[]
}

/**
 * The settled outcome the narrator stages: a verdict, and a qualitative degree
 * when a roll decided it — never a number.
 */
export type OutcomeToNarrate = {
  mode: ResolutionMode
  result: RollOutcome
  /** Null when no roll was made: an automatic outcome has no degree. */
  degree: Degree | null
  /** Why the world stops the character, for an automatic failure only. */
  reason: string | null
}

/**
 * First aid as the narration stages it: on whom — the character when null —
 * and what it did, never by how much. `already_tended`: the wound had been
 * seen to since it was dealt, and nothing more could be done.
 */
export type NarratedFirstAid = {
  target: string | null
  effect: 'healed' | 'no_effect' | 'worsened' | 'already_tended'
  /** A dying person kept alive, a bleeding stopped, someone down brought round. */
  saved: boolean
}

export type NarrationRequest = TurnContext & {
  outcome: OutcomeToNarrate
  /** The round of combat this turn was, in labels; null when it was none. */
  combat: NarratedRound | null
  first_aid: NarratedFirstAid | null
  /** The game clock once the turn is over: the narration tells where it ends. */
  game_time_after: number
  /** The way to the destination arbitration named, passage by passage; null when it named none. */
  route: Route | null
  /** Who was left at the destination and is there still, with their definition for naming them. */
  npcs_at_destination: (PresentNpc & { definition: string })[]
  intent_summary: string
  /** The player spoke to the game master rather than acting: answer, do not move the story. */
  aside: boolean
  /** The lore the scene and the arrival call for: ambiance and facts, never a secret. */
  lore: LoreFragmentContent[]
}

/** What extraction reads: the narration as written, and the scene it happened in. */
export type ExtractionRequest = Pick<TurnContext, 'world' | 'scene' | 'character'> & {
  narration: string
  /**
   * The closed list of definitions an item may come into being from:
   * archetypes, and unique items the game has not met and nobody holds.
   */
  creatable_items: string[]
  /**
   * The closed list of people who may come into the scene: archetypes, and
   * unique characters met before, waiting nowhere in particular, or waiting
   * here or within reach from the start.
   */
  enterable_npcs: string[]
  /**
   * Where a movement may lead from where the scene began: the places the
   * exits reach — once those it finds or opens are — or, outside a network,
   * the places travelled to freely; and whether a place may be improvised,
   * within which named ones.
   */
  movement: MovementOptions
}

export type MovementOptions = {
  destinations: string[]
  archetypes: string[]
  parents: string[]
}
