import type {
  ContextualModifier,
  Difficulty,
  MarginLabel,
  RollOutcome,
} from '#services/rules/types'
import type { NpcDisposition, WorldDefinition } from '#services/game/world'
import type { ActionType } from '#services/game/resolution_rules'
import type { PresentNpc } from '#services/game/npcs'
import type { ItemsInScene } from '#services/game/inventory'

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
}

export type ArbitrationOutput = {
  intent: {
    type: string
    target: string | null
    summary: string
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
  alert: {
    prompt_injection_suspected: boolean
    out_of_scope: boolean
  }
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
  /**
   * What the character, the people present and the place hold. Each step is
   * handed its own view of it, never the modifiers.
   */
  items: ItemsInScene
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
  recent_buffer: RecentTurn[]
  player_input: string
  language: GameLanguage
}

/** Arbitration also gets the world's closed list of action types, read from `resolution_rules`. */
export type ArbitrationContext = TurnContext & {
  action_types: ActionType[]
}

/**
 * The settled outcome the narrator stages: a verdict, and a qualitative margin
 * when a roll decided it — never a number.
 */
export type OutcomeToNarrate = {
  mode: ResolutionMode
  result: RollOutcome
  /** Null when no roll was made: an automatic outcome has no margin. */
  margin: MarginLabel | null
  /** Why the world stops the character, for an automatic failure only. */
  reason: string | null
}

export type NarrationRequest = TurnContext & {
  outcome: OutcomeToNarrate
  intent_summary: string
  /** The player spoke to the game master rather than acting: answer, do not move the story. */
  aside: boolean
}

/** What extraction reads: the narration as written, and the scene it happened in. */
export type ExtractionRequest = Pick<TurnContext, 'world' | 'scene' | 'character'> & {
  narration: string
  /**
   * The closed list of definitions an item may come into being from:
   * archetypes, and unique items the game has not met and nobody holds.
   */
  creatable_items: string[]
}
