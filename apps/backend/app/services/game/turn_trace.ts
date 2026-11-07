import TurnLog from '#models/turn_log'
import { describeTurnFailure } from '#exceptions/turn_failure'
import type { LlmCallMetadata } from '#services/llm/types'
import type { Degree, RollResolution } from '#services/rules/types'
import type { Duration } from '#services/game/game_time'

import type { ArbitrationOutput } from './prompts/types.js'
import type { Round } from './combat.js'
import type { RejectionReason } from './turn_validator.js'

/** The steps of a turn that call the model. */
export type TurnStep = 'arbitration' | 'narration' | 'extraction'

/**
 * A structured output validation refused. Kept whatever happens next: a
 * second attempt that succeeds does not erase the first, which feeds the
 * evaluation corpus and the rejection rate.
 */
export type RejectedAttempt = {
  step: TurnStep
  /** Which attempt of that step, counting from 1. */
  attempt: number
  /** As the model sent it, parsed when it could be. */
  output: unknown
  reasons: RejectionReason[]
}

/**
 * Everything a turn produced, filled as the pipeline progresses so that a turn
 * dying halfway still leaves behind every step it had played.
 */
/**
 * A roll as logged: the engine's resolution — what was rolled, the chance, the
 * d100 and the degree — with the category it was made on.
 */
export type TracedRoll = RollResolution & {
  actionType: string
}

/**
 * The game clock on both sides of the turn, and the duration arbitration
 * proposed — set once arbitration has ruled, so the narration can tell when
 * the turn ends.
 */
export type TracedTime = {
  before: number
  after: number
  duration: Duration
}

/**
 * The references of the lore fragments each step was sent, null for a step
 * the turn did not reach — to tell afterwards where the narration took
 * something from.
 */
export type TracedLore = {
  arbitration: string[] | null
  narration: string[] | null
}

/**
 * The round of combat a turn played, every roll of it — the people's hidden
 * ones included — and the archetype brought in for it, if the opponent was
 * one: the backend creates them when the turn applies.
 */
export type TracedRound = Round & { provisional: { definition: string } | null }

/**
 * First aid given this turn: to whom — the character, or someone by handle —
 * on what degree, and what it did. Nothing when the wound was already tended.
 */
export type TracedFirstAid = {
  target: string | null
  degree: Degree
  /** Whether a wound was there to tend since the last attempt. */
  available: boolean
  /** Hit points it gave back: negative on a fumble, 0 on a failure. */
  healed: number
  /** A dying person kept alive, a bleeding stopped, someone down brought round. */
  saved: boolean
}

/** What an event's harm did to the character, one per `character_harmed` that reached them. */
export type TracedHarm = {
  damage: string
  rolled: number
  armor: number
  total: number
}

/** An event of the state as the end of a turn settled it. */
export type SettledStateEvent = {
  event: string
  outcome: 'fired' | 'armed' | 'cancelled'
  witnessed: boolean
  /** Present only when the event hurt the character. */
  harm?: TracedHarm[]
}

/**
 * What the scenario's events did in a turn (roadmap, Phase 11): those the
 * clock brought, those the state set off once the turn applied, what cut the
 * turn short or ended a wait, and what the chain left for the next turn.
 */
export type TracedEvents = {
  /** The timed events the turn's clock brought, in the order they fell. */
  timed: {
    event: string
    at: number
    outcome: 'fired' | 'cancelled'
    witnessed: boolean
    /** Present only when the event hurt the character. */
    harm?: TracedHarm[]
  }[]
  /** The events the state set off, armed or cancelled once the turn applied. */
  state: SettledStateEvent[]
  /** Events of an earlier turn this narration told. */
  told: string[]
  /** What cut the action short: an event, or someone's arrival. */
  interrupted: { event: string; at: number } | { npc: string; at: number } | null
  /** What the character waited for, and whether it came. */
  awaited: { event: string; arrived: boolean } | { npc: string; arrived: boolean } | null
  /** Still due when the chain reached its depth: taken up at the end of the next turn. */
  deferred: string[]
}

export type TurnTrace = {
  arbitration: ArbitrationOutput | null
  roll: TracedRoll | null
  combat: TracedRound | null
  firstAid: TracedFirstAid | null
  time: TracedTime | null
  events: TracedEvents | null
  narration: string | null
  extraction: Record<string, unknown> | null
  lore: TracedLore
  rejectedAttempts: RejectedAttempt[]
  calls: TracedCall[]
}

type TracedCall = {
  metadata: LlmCallMetadata
  attempt: number
}

/**
 * What the player was told, kept so that reading the turn back tells them the
 * same thing. The step and the rejected rules are for whoever debugs it.
 */
export type StoredFailure = {
  code: string
  message: string
  step?: string
  reasons?: { field: string; rule: string; message: string }[]
}

export function emptyTrace(): TurnTrace {
  return {
    arbitration: null,
    roll: null,
    combat: null,
    firstAid: null,
    time: null,
    events: null,
    narration: null,
    extraction: null,
    lore: { arbitration: null, narration: null },
    rejectedAttempts: [],
    calls: [],
  }
}

/** Records a model call, accepted or not: every call is paid for. */
export function recordCall(trace: TurnTrace, metadata: LlmCallMetadata, attempt = 1): void {
  trace.calls.push({ metadata, attempt })
}

export function recordRejection(trace: TurnTrace, rejection: RejectedAttempt): void {
  trace.rejectedAttempts.push(rejection)
}

/** The trace as `turn_log` columns, for a turn that completed as for one that failed. */
export function traceColumns(trace: TurnTrace) {
  return {
    arbitrationOutput: trace.arbitration as Record<string, unknown> | null,
    rollResult: trace.roll as Record<string, unknown> | null,
    combatResult: trace.combat as unknown as Record<string, unknown> | null,
    firstAid: trace.firstAid as unknown as Record<string, unknown> | null,
    gameTimeBefore: trace.time?.before ?? null,
    gameTimeAfter: trace.time?.after ?? null,
    duration: trace.time?.duration ?? null,
    eventsFired: trace.events,
    narratedText: trace.narration,
    extractionOutput: trace.extraction,
    loreSent: trace.lore.arbitration === null ? null : trace.lore,
    rejectedAttempts:
      trace.rejectedAttempts.length > 0
        ? (trace.rejectedAttempts as unknown as Record<string, unknown>[])
        : null,
    alerts: toAlerts(trace.arbitration),
    /**
     * Every call of the turn, rejected attempts included, so the real cost of
     * a turn is the sum of what it actually spent — including the steps of a
     * turn that then failed.
     */
    llmUsage: trace.calls.map(toUsageRow),
  }
}

/**
 * Marks a turn failed, with whatever the pipeline had produced and why it
 * stopped. Read afresh: the instance that failed may still be bound to the
 * transaction that rolled back.
 *
 * Returns the failure written, or `null` if the turn was already settled.
 */
export async function markFailed(
  turnId: string,
  trace: TurnTrace,
  error: unknown
): Promise<StoredFailure | null> {
  const turn = await TurnLog.findOrFail(turnId)

  /** Already settled — by the sweep, most likely. The first outcome stands. */
  if (turn.status !== 'pending') {
    return null
  }

  const failure = toStoredFailure(error)

  turn.merge({
    ...traceColumns(trace),
    status: 'failed',
    /** A failed turn never takes a place in the story. */
    turnNumber: null,
    appliedEffects: null,
    failure,
  })

  await turn.save()

  return failure
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

function toUsageRow({ metadata, attempt }: TracedCall): Record<string, unknown> {
  return usageRow(metadata, attempt)
}

/**
 * Step and attempt on every row, so cost can be read per step and per retry.
 * The same shape wherever a call is paid for: a turn's, a summary's.
 */
export function usageRow(metadata: LlmCallMetadata, attempt = 1): Record<string, unknown> {
  return {
    step: metadata.step,
    attempt,
    provider: metadata.provider,
    model: metadata.model,
    input_tokens: metadata.usage.inputTokens,
    output_tokens: metadata.usage.outputTokens,
    reasoning_tokens: metadata.usage.reasoningTokens,
    total_tokens: metadata.usage.totalTokens,
    duration_ms: metadata.durationMs,
  }
}
