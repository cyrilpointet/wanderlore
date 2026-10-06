import type { Difficulty, MarginLabel, RollOutcome } from '#services/rules/types'
import type { WorldDefinition } from '#services/game/world'
import type { ActionType } from '#services/game/resolution_rules'
import type { PresentNpc } from '#services/game/npcs'

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
 * Effects the model may propose, limited to what the current state can receive.
 *
 * No items before Phase 4, and nothing about NPCs before the extraction step
 * (E) proposes their entrances, exits and dispositions. A field the backend
 * would reject on every turn is not worth the tokens it costs on every turn.
 */
export type TurnEffects = {
  movement: string | null
  scenario_flags: string[]
  hit_points_delta: number
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
  }
  alert: {
    prompt_injection_suspected: boolean
    out_of_scope: boolean
  }
}

export type NarrationOutput = {
  narration: string
  effects: TurnEffects
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
  world_objects: Record<string, unknown>[]
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
}
