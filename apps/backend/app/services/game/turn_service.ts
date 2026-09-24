import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import TurnLog from '#models/turn_log'
import { describeTurnFailure } from '#exceptions/turn_failure'
import Session from '#models/session'
import type Character from '#models/character'
import type WorldState from '#models/world_state'
import type { LlmGateway } from '#services/llm/gateway'
import type { LlmCallMetadata } from '#services/llm/types'
import type { RulesEngine } from '#services/rules/engine'
import { toNarrationOutcome } from '#services/rules/engine'
import type { NarrationOutcome, RollResolution } from '#services/rules/types'

import { ConcurrentTurnError, isTurnNumberConflict } from './errors.js'
import { THREE_MUSKETEERS, locationReferences } from './world.js'
import {
  ARBITRATION_SCHEMA,
  ARBITRATION_SYSTEM_PROMPT,
  buildArbitrationMessage,
} from './prompts/arbitration.js'
import {
  NARRATION_SCHEMA,
  NARRATION_SYSTEM_PROMPT,
  buildNarrationMessage,
} from './prompts/narration.js'
import type {
  ArbitrationOutput,
  GameLanguage,
  RecentTurn,
  TurnContext,
  TurnEffects,
} from './prompts/types.js'
import { type ValidationMeta, validateArbitration, validateNarration } from './turn_validator.js'

/**
 * How many past turns travel to the model as the recent buffer.
 *
 * Re-sent in full on every turn, so it is the dominant cost driver of a long
 * session. The long-term memory that would let it stay small is Phase 7.
 */
const RECENT_TURNS = 5

/**
 * Phase 1 plays in English. Still passed explicitly at every step rather than
 * hardcoded downstream: the architecture document requires the language to
 * never be assumed fixed.
 */
export const DEFAULT_LANGUAGE: GameLanguage = 'en'

export type TurnRequest = {
  sessionId: string
  /**
   * Whose session it is. The lookup is scoped to it rather than checked
   * afterwards, so someone else's session reads as one that does not exist.
   */
  userId: string
  playerInput: string
  language?: GameLanguage
}

/**
 * What the player gets to see of a roll: the skill, the verdict and a
 * qualitative margin — never the dice, the threshold or the total.
 */
export type TurnRoll = NarrationOutcome & {
  skill: string
}

export type TurnResult = {
  turnNumber: number
  narration: string
  roll: TurnRoll | null
  effects: TurnEffects
}

/**
 * One turn, end to end.
 *
 * Synchronous on purpose at this phase: moving it behind BullMQ and streaming
 * it over SSE is Phase 2, and regenerating the narrative summary is Phase 7.
 */
export class TurnService {
  #llm: LlmGateway
  #rules: RulesEngine

  constructor(llm: LlmGateway, rules: RulesEngine) {
    this.#llm = llm
    this.#rules = rules
  }

  async play(request: TurnRequest): Promise<TurnResult> {
    const language = request.language ?? DEFAULT_LANGUAGE
    const scene = await this.#loadScene(request.sessionId, request.userId)
    const turnNumber = scene.lastTurnNumber + 1

    /**
     * Filled as the pipeline progresses, so a turn that dies halfway still
     * leaves behind everything it had managed to produce.
     */
    const trace: TurnTrace = {
      arbitration: null,
      roll: null,
      narration: null,
      usage: [],
    }

    try {
      const result = await this.#runPipeline(request, scene, language, trace)

      const applied = await this.#persist(
        request,
        scene,
        turnNumber,
        language,
        trace,
        result.effects
      )

      return { turnNumber, ...result, effects: applied }
    } catch (error) {
      /**
       * The log of a failed turn is what makes the failure debuggable at all,
       * so it is written before the error is re-thrown — and its own failure is
       * swallowed rather than allowed to mask the real one.
       *
       * A collision is the exception: that turn number belongs to the request
       * that won, and logging under it would only collide again.
       */
      if (!(error instanceof ConcurrentTurnError)) {
        await writeTurn(request, scene, turnNumber, language, trace, {
          status: 'failed',
          failure: toStoredFailure(error),
        }).catch(() => {})
      }

      throw error
    }
  }

  async #runPipeline(
    request: TurnRequest,
    scene: LoadedScene,
    language: GameLanguage,
    trace: TurnTrace
  ): Promise<Omit<TurnResult, 'turnNumber'>> {
    const context = buildContext(scene, request.playerInput, language)
    const meta: ValidationMeta = {
      skills: Object.keys(scene.character.skills),
      locations: locationReferences(THREE_MUSKETEERS),
      hitPointsMax: scene.character.hitPointsMax,
    }

    const arbitration = await this.#llm.generateJson<unknown>('arbitration', {
      systemPrompt: ARBITRATION_SYSTEM_PROMPT,
      userMessage: buildArbitrationMessage(context),
      jsonSchema: ARBITRATION_SCHEMA as unknown as Record<string, unknown>,
    })

    trace.usage.push(arbitration.metadata)

    const decision = await validateArbitration(arbitration.content, meta)
    trace.arbitration = decision

    /**
     * No roll: arbitration already narrated and extracted, because the outcome
     * was settled the moment it ruled. One call, and the turn is done.
     */
    if (decision.resolution.mode !== 'roll_required') {
      trace.narration = decision.narration

      return {
        narration: decision.narration as string,
        roll: null,
        effects: decision.effects as TurnEffects,
      }
    }

    const skill = decision.resolution.skill_used as string
    const resolution = this.#rules.resolve(
      scene.character.skills[skill],
      decision.resolution.difficulty!
    )

    trace.roll = resolution

    const narration = await this.#llm.generateJson<unknown>('narration', {
      systemPrompt: NARRATION_SYSTEM_PROMPT,
      userMessage: buildNarrationMessage({
        ...context,
        /** A verdict and a qualitative margin. Never the dice or the threshold. */
        outcome: toNarrationOutcome(resolution),
        intent_summary: decision.intent.summary,
      }),
      jsonSchema: NARRATION_SCHEMA as unknown as Record<string, unknown>,
    })

    trace.usage.push(narration.metadata)

    const narrated = await validateNarration(narration.content, meta)
    trace.narration = narrated.narration

    return {
      narration: narrated.narration,
      roll: { skill, ...toNarrationOutcome(resolution) },
      effects: narrated.effects,
    }
  }

  async #loadScene(sessionId: string, userId: string): Promise<LoadedScene> {
    const session = await Session.query()
      .where('id', sessionId)
      .where('userId', userId)
      .preload('characters')
      .preload('worldState')
      .firstOrFail()

    const character = session.characters[0]

    if (!character) {
      throw new Error(`Session ${sessionId} has no character to play.`)
    }

    /**
     * Completed turns only: a failed turn is not part of the story, and handing
     * the model an action that never happened would have it narrate around it.
     */
    const turns = await TurnLog.query()
      .where('sessionId', sessionId)
      .withScopes((scopes) => scopes.completed())
      .orderBy('turnNumber', 'desc')
      .limit(RECENT_TURNS)

    /** Every turn, failed ones included, holds its number. */
    const last = await TurnLog.query()
      .where('sessionId', sessionId)
      .max('turn_number as max')
      .first()

    return {
      session,
      character,
      worldState: session.worldState,
      /** Oldest first, so the model reads the exchange in the order it happened. */
      recentTurns: turns.reverse(),
      lastTurnNumber: Number(last?.$extras.max ?? 0),
    }
  }

  /**
   * State change and turn log land together: a state that moved without a log
   * entry explaining it would be impossible to reconstruct afterwards.
   *
   * Returns the effects as applied, which is what the player is shown.
   */
  async #persist(
    request: TurnRequest,
    scene: LoadedScene,
    turnNumber: number,
    language: GameLanguage,
    trace: TurnTrace,
    effects: TurnEffects
  ): Promise<TurnEffects> {
    try {
      return await db.transaction(async (trx) => {
        const applied = await applyEffects(scene, effects, trx)

        scene.session.lastActivityAt = DateTime.now()
        await scene.session.useTransaction(trx).save()

        await writeTurn(
          request,
          scene,
          turnNumber,
          language,
          trace,
          { status: 'completed', applied },
          trx
        )

        return applied
      })
    } catch (error) {
      /**
       * Another request reached this turn number first. The transaction rolled
       * back, so nothing of this turn was applied.
       */
      if (isTurnNumberConflict(error)) {
        throw new ConcurrentTurnError(turnNumber)
      }

      throw error
    }
  }
}

type LoadedScene = {
  session: Session
  character: Character
  worldState: WorldState
  recentTurns: TurnLog[]
  lastTurnNumber: number
}

type TurnTrace = {
  arbitration: ArbitrationOutput | null
  roll: RollResolution | null
  narration: string | null
  usage: LlmCallMetadata[]
}

function buildContext(
  scene: LoadedScene,
  playerInput: string,
  language: GameLanguage
): TurnContext {
  return {
    world: THREE_MUSKETEERS,
    character: {
      name: scene.character.name,
      skills: scene.character.skills,
      hit_points: scene.character.hitPoints,
      hit_points_max: scene.character.hitPointsMax,
    },
    scene: {
      location: scene.worldState.currentLocation,
      narrative_flags: scene.worldState.narrativeFlags,
      visited_locations: scene.worldState.visitedLocations,
      world_objects: scene.worldState.worldObjects,
    },
    recent_buffer: toRecentBuffer(scene.recentTurns),
    player_input: playerInput,
    language,
  }
}

function toRecentBuffer(turns: TurnLog[]): RecentTurn[] {
  return turns.flatMap((turn) => {
    const entries: RecentTurn[] = [{ role: 'player', text: turn.playerInput }]

    if (turn.narratedText) {
      entries.push({ role: 'narration', text: turn.narratedText })
    }

    return entries
  })
}

/**
 * Applies the validated delta. Everything here is deterministic: the model
 * proposed, the backend decides what the numbers actually become.
 *
 * Returns what actually changed, which can be less than what was proposed: a
 * delta clamped at zero hit points, or a "movement" to where the character
 * already stands.
 */
async function applyEffects(
  scene: LoadedScene,
  effects: TurnEffects,
  trx: TransactionClientContract
): Promise<TurnEffects> {
  const { character, worldState } = scene
  const hitPointsBefore = character.hitPoints

  if (effects.hit_points_delta !== 0) {
    /**
     * Clamped rather than trusted: validation bounds the size of the swing, not
     * where it lands.
     */
    character.hitPoints = Math.max(
      0,
      Math.min(character.hitPointsMax, character.hitPoints + effects.hit_points_delta)
    )

    await character.useTransaction(trx).save()
  }

  const movement = effects.movement
  const moved = movement !== null && movement !== worldState.currentLocation

  if (moved) {
    worldState.visitedLocations = [...worldState.visitedLocations, { reference: movement }]
  }

  if (effects.scenario_flags.length > 0) {
    worldState.narrativeFlags = {
      ...worldState.narrativeFlags,
      ...Object.fromEntries(effects.scenario_flags.map((flag) => [flag, true])),
    }
  }

  if (moved || effects.scenario_flags.length > 0) {
    await worldState.useTransaction(trx).save()
  }

  return {
    movement: moved ? movement : null,
    scenario_flags: effects.scenario_flags,
    hit_points_delta: character.hitPoints - hitPointsBefore,
  }
}

/**
 * How a turn ended. Only a completed turn applied anything, so only a completed
 * turn has effects to record — a failed one records why it failed instead.
 */
type TurnEnding =
  { status: 'completed'; applied: TurnEffects } | { status: 'failed'; failure: StoredFailure }

async function writeTurn(
  request: TurnRequest,
  scene: LoadedScene,
  turnNumber: number,
  language: GameLanguage,
  trace: TurnTrace,
  ending: TurnEnding,
  trx?: TransactionClientContract
): Promise<void> {
  const turn = new TurnLog()

  turn.merge({
    sessionId: scene.session.id,
    turnNumber,
    playerInput: request.playerInput,
    language,
    arbitrationOutput: trace.arbitration as Record<string, unknown> | null,
    rollResult: trace.roll as Record<string, unknown> | null,
    narratedText: trace.narration,
    status: ending.status,
    appliedEffects: ending.status === 'completed' ? ending.applied : null,
    failure: ending.status === 'failed' ? ending.failure : null,
    alerts: toAlerts(trace.arbitration),
    /**
     * Both calls of a turn are recorded, so the real cost of a turn is the sum
     * of what it actually spent — including the arbitration of a turn that then
     * failed in narration.
     */
    llmUsage: trace.usage.map(toUsageRow),
  })

  if (trx) {
    turn.useTransaction(trx)
  }

  await turn.save()
}

/**
 * What the player was told, kept so that reading the turn back tells them the
 * same thing. The step and the rejected rules are for whoever debugs it.
 */
type StoredFailure = {
  code: string
  message: string
  step?: string
  reasons?: { field: string; rule: string; message: string }[]
}

function toStoredFailure(error: unknown): StoredFailure {
  const failure = describeTurnFailure(error)

  if (!failure) {
    return { code: 'unexpected_error', message: 'Something went wrong while playing this turn.' }
  }

  const { status, ...stored } = failure

  return stored
}

function toAlerts(arbitration: ArbitrationOutput | null): Record<string, unknown>[] | null {
  if (!arbitration) {
    return null
  }

  const raised = Object.entries(arbitration.alert)
    .filter(([, value]) => value === true)
    .map(([kind]) => ({ kind }))

  return raised.length > 0 ? raised : null
}

function toUsageRow(metadata: LlmCallMetadata): Record<string, unknown> {
  return {
    step: metadata.step,
    provider: metadata.provider,
    model: metadata.model,
    input_tokens: metadata.usage.inputTokens,
    output_tokens: metadata.usage.outputTokens,
    reasoning_tokens: metadata.usage.reasoningTokens,
    total_tokens: metadata.usage.totalTokens,
    duration_ms: metadata.durationMs,
  }
}
