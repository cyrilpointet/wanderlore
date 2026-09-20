import type { Difficulty, NarrationOutcome } from '#services/rules/types'
import type { WorldDefinition } from '#services/game/world'

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
 * No items and no NPC relations: there is no inventory table before Phase 4 and
 * no NPC instance table at all yet. A field the backend would reject on every
 * turn is not worth the tokens it costs on every turn.
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
    /** Must come from the world's skill list. Null unless a roll is required. */
    skill_used: string | null
    difficulty: Difficulty | null
  }
  /**
   * Filled only when no roll is required — that is the whole point of the
   * merged call. Null when `mode` is `roll_required`, because the outcome is
   * not known yet and the backend, not the model, decides it.
   */
  narration: string | null
  effects: TurnEffects | null
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
  location: string | null
  narrative_flags: Record<string, unknown>
  visited_locations: Record<string, unknown>[]
  world_objects: Record<string, unknown>[]
}

export type CharacterContext = {
  name: string
  skills: Record<string, number>
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

/**
 * What the narration step is given on top of the turn context when a roll
 * happened: a verdict and a qualitative margin, never a number.
 */
export type NarrationRequest = TurnContext & {
  outcome: NarrationOutcome | null
  intent_summary: string
}
