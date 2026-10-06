import TurnLog from '#models/turn_log'
import { describeTurnFailure } from '#exceptions/turn_failure'
import type { LlmCallMetadata } from '#services/llm/types'
import type { RollResolution } from '#services/rules/types'

import type { ArbitrationOutput } from './prompts/types.js'
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
export type TurnTrace = {
  arbitration: ArbitrationOutput | null
  roll: RollResolution | null
  narration: string | null
  extraction: Record<string, unknown> | null
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
    narration: null,
    extraction: null,
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
    narratedText: trace.narration,
    extractionOutput: trace.extraction,
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

/** Step and attempt on every row, so cost can be read per step and per retry. */
function toUsageRow({ metadata, attempt }: TracedCall): Record<string, unknown> {
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
