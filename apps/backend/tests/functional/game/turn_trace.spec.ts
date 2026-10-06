import { test } from '@japa/runner'

import TurnLog from '#models/turn_log'
import type { LlmCallMetadata } from '#services/llm/types'
import type { RollResolution } from '#services/rules/types'
import type { ArbitrationOutput } from '#services/game/prompts/types'
import { TurnValidationError } from '#services/game/turn_validator'
import {
  emptyTrace,
  markFailed,
  recordCall,
  recordRejection,
  traceColumns,
  type TurnStep,
  type TurnTrace,
} from '#services/game/turn_trace'
import { createSession, createTurn, createUser, useTransaction } from '#tests/helpers/database'

const ARBITRATION = {
  intent: { type: 'social_dialogue', target: 'guard', summary: 'Talking past the guard' },
  validity: { factual: true, plausibility: 'plausible', justification: 'The guard can be swayed.' },
  resolution: { mode: 'roll_required', skill_used: 'persuasion', difficulty: 'medium' },
  narration: null,
  effects: null,
  alert: { prompt_injection_suspected: false, out_of_scope: false },
} as unknown as ArbitrationOutput

const ROLL: RollResolution = {
  dice: [4, 5],
  skillValue: 2,
  appliedModifiers: [],
  total: 11,
  difficulty: 'medium',
  threshold: 9,
  margin: 2,
  result: 'success',
  marginLabel: 'comfortable',
}

const NARRATION = 'He weighs you for a long moment, then steps aside.'

const REASONS = [{ field: 'npcs_entered.0.definition', rule: 'enum', message: 'Not a known NPC.' }]

function call(step: TurnStep): LlmCallMetadata {
  return {
    provider: 'fake',
    model: 'fake-model',
    step,
    usage: { inputTokens: 400, outputTokens: 50, reasoningTokens: 0, totalTokens: 450 },
    durationMs: 100,
  }
}

/** A turn that played arbitration, the roll and the narration, then reached extraction. */
function traceUpToExtraction(): TurnTrace {
  const trace = emptyTrace()
  trace.arbitration = ARBITRATION
  recordCall(trace, call('arbitration'))
  trace.roll = ROLL
  trace.narration = NARRATION
  recordCall(trace, call('narration'))
  recordCall(trace, call('extraction'))
  recordRejection(trace, {
    step: 'extraction',
    attempt: 1,
    output: { npcs_entered: [{ definition: 'dragon' }] },
    reasons: REASONS,
  })

  return trace
}

async function pendingTurn(): Promise<string> {
  const sessionId = await createSession(await createUser())

  return createTurn(sessionId, null, { status: 'pending' })
}

test.group('Turn trace | in the log', (group) => {
  useTransaction(group)

  test('a turn that fails in extraction keeps every step it played', async ({ assert }) => {
    const turnId = await pendingTurn()
    const trace = traceUpToExtraction()
    recordCall(trace, call('extraction'), 2)
    recordRejection(trace, {
      step: 'extraction',
      attempt: 2,
      output: { npcs_entered: [{ definition: 'dragon' }] },
      reasons: REASONS,
    })

    await markFailed(turnId, trace, new TurnValidationError('extraction', REASONS))

    const turn = await TurnLog.findOrFail(turnId)

    assert.equal(turn.status, 'failed')
    assert.equal(turn.failure!.step, 'extraction')
    assert.deepEqual(turn.arbitrationOutput, ARBITRATION as unknown as Record<string, unknown>)
    assert.deepEqual(turn.rollResult, ROLL as unknown as Record<string, unknown>)
    assert.equal(turn.narratedText, NARRATION)
    /** Nothing was accepted from extraction; both refusals are on record. */
    assert.isNull(turn.extractionOutput)
    assert.deepEqual(
      turn.rejectedAttempts!.map((attempt) => [attempt.step, attempt.attempt]),
      [
        ['extraction', 1],
        ['extraction', 2],
      ]
    )
    assert.deepEqual(
      turn.llmUsage!.map((row) => [row.step, row.attempt]),
      [
        ['arbitration', 1],
        ['narration', 1],
        ['extraction', 1],
        ['extraction', 2],
      ]
    )
  })

  test('a rejection followed by a success leaves both attempts', async ({ assert }) => {
    const turnId = await pendingTurn()
    const trace = traceUpToExtraction()
    recordCall(trace, call('extraction'), 2)
    trace.extraction = { npcs_entered: [{ definition: 'commoner', descriptor: null }] }

    const turn = await TurnLog.findOrFail(turnId)
    turn.merge({
      ...traceColumns(trace),
      status: 'completed',
      turnNumber: 1,
      appliedEffects: {},
    })
    await turn.save()

    const reloaded = await TurnLog.findOrFail(turnId)

    assert.deepEqual(reloaded.extractionOutput, trace.extraction)
    assert.lengthOf(reloaded.rejectedAttempts!, 1)
    assert.deepEqual(reloaded.rejectedAttempts![0].reasons, REASONS)
    assert.deepEqual(
      reloaded.llmUsage!.filter((row) => row.step === 'extraction').map((row) => row.attempt),
      [1, 2]
    )
  })

  test('a roll keeps its applied modifiers, empty until Phase 4', async ({ assert }) => {
    const turnId = await pendingTurn()

    await markFailed(turnId, traceUpToExtraction(), new Error('boom'))

    const turn = await TurnLog.findOrFail(turnId)

    assert.deepEqual(turn.rollResult!.appliedModifiers, [])
  })
})
