import { test } from '@japa/runner'

import type { LlmCallMetadata } from '#services/llm/types'
import {
  emptyTrace,
  recordCall,
  recordRejection,
  traceColumns,
  type TurnStep,
} from '#services/game/turn_trace'

function call(step: TurnStep, totalTokens: number): LlmCallMetadata {
  return {
    provider: 'fake',
    model: 'fake-model',
    step,
    usage: { inputTokens: totalTokens - 10, outputTokens: 10, reasoningTokens: 0, totalTokens },
    durationMs: 100,
  }
}

const REJECTED_EFFECTS = { npcs_entered: [{ definition: 'dragon', descriptor: null }] }

test.group('Turn trace', () => {
  test('an untouched trace leaves every step column empty', ({ assert }) => {
    const columns = traceColumns(emptyTrace())

    assert.isNull(columns.arbitrationOutput)
    assert.isNull(columns.rollResult)
    assert.isNull(columns.narratedText)
    assert.isNull(columns.extractionOutput)
    /** No rejection reads as none, not as an empty list to look into. */
    assert.isNull(columns.rejectedAttempts)
    assert.deepEqual(columns.llmUsage, [])
  })

  test('tags every call with its step and attempt', ({ assert }) => {
    const trace = emptyTrace()
    recordCall(trace, call('arbitration', 900))
    recordCall(trace, call('narration', 700))
    recordCall(trace, call('extraction', 400))
    recordCall(trace, call('extraction', 450), 2)

    const usage = traceColumns(trace).llmUsage

    assert.deepEqual(
      usage.map((row) => [row.step, row.attempt, row.total_tokens]),
      [
        ['arbitration', 1, 900],
        ['narration', 1, 700],
        ['extraction', 1, 400],
        ['extraction', 2, 450],
      ]
    )
  })

  test('a rejection followed by a success leaves both attempts', ({ assert }) => {
    const trace = emptyTrace()
    recordCall(trace, call('extraction', 400))
    recordRejection(trace, {
      step: 'extraction',
      attempt: 1,
      output: REJECTED_EFFECTS,
      reasons: [{ field: 'npcs_entered.0.definition', rule: 'enum', message: 'Not a known NPC.' }],
    })
    recordCall(trace, call('extraction', 450), 2)
    trace.extraction = { npcs_entered: [{ definition: 'commoner', descriptor: null }] }

    const columns = traceColumns(trace)

    /** The accepted output in its column, the refused one on record beside it. */
    assert.deepEqual(columns.extractionOutput, trace.extraction)
    assert.deepEqual(columns.rejectedAttempts, [
      {
        step: 'extraction',
        attempt: 1,
        output: REJECTED_EFFECTS,
        reasons: [
          { field: 'npcs_entered.0.definition', rule: 'enum', message: 'Not a known NPC.' },
        ],
      },
    ])
    /** Both calls were paid for, so both count in the cost of the turn. */
    assert.lengthOf(columns.llmUsage, 2)
  })
})
