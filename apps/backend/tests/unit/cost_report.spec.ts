import { test } from '@japa/runner'

import { type LoggedTurn, costReport } from '#services/game/cost_report'

function call(step: string, attempt: number, input: number, output: number, reasoning = 0) {
  return {
    step,
    attempt,
    input_tokens: input,
    output_tokens: output,
    reasoning_tokens: reasoning,
    total_tokens: input + output + reasoning,
  }
}

function turn(overrides: Partial<LoggedTurn> = {}): LoggedTurn {
  return {
    sessionId: 'game-1',
    language: 'en',
    status: 'completed',
    llmUsage: [
      call('arbitration', 1, 1000, 100),
      call('narration', 1, 1500, 300),
      call('extraction', 1, 800, 100),
    ],
    rejectedAttempts: null,
    ...overrides,
  }
}

/** One dollar per million either way: costs read as millions of tokens. */
const FLAT = { inputPerMillion: 1, outputPerMillion: 1 }

test.group('Cost report | averages', () => {
  test('averages tokens per turn and per game', ({ assert }) => {
    const report = costReport([
      turn(),
      turn(),
      turn({ sessionId: 'game-2' }),
      turn({ sessionId: 'game-2' }),
    ])

    assert.equal(report.turns.total, 4)
    assert.equal(report.games, 2)
    assert.equal(report.perTurn.totalTokens, 3800)
    assert.equal(report.perTurn.calls, 3)
    assert.equal(report.perGame.totalTokens, 7600)
  })

  test('counts failed turns, which were paid for too, but not turns still playing', ({
    assert,
  }) => {
    const report = costReport([
      turn(),
      turn({ status: 'failed', llmUsage: [call('arbitration', 1, 1000, 100)] }),
      turn({ status: 'pending', llmUsage: [call('arbitration', 1, 99_999, 0)] }),
    ])

    assert.deepEqual(report.turns, { total: 2, completed: 1, failed: 1 })
    assert.equal(report.overall.totalTokens, 3800 + 1100)
  })

  test('averages nothing to zero rather than to NaN', ({ assert }) => {
    const report = costReport([])

    assert.equal(report.perTurn.totalTokens, 0)
    assert.equal(report.perGame.totalTokens, 0)
  })
})

test.group('Cost report | pricing', () => {
  test('prices input and output apart, reasoning as output', ({ assert }) => {
    const report = costReport(
      [turn({ llmUsage: [call('narration', 1, 1_000_000, 500_000, 500_000)] })],
      { inputPerMillion: 0.3, outputPerMillion: 2.5 }
    )

    assert.closeTo(report.overall.cost!, 0.3 + 2.5, 1e-9)
  })

  test('gives tokens only without a pricing', ({ assert }) => {
    const report = costReport([turn()])

    assert.isNull(report.overall.cost)
    assert.isNull(report.perStep[0].rejectedCostShare)
  })
})

test.group('Cost report | per step', () => {
  test('splits by step, in pipeline order', ({ assert }) => {
    const report = costReport([turn()], FLAT)

    assert.deepEqual(
      report.perStep.map(({ step, totalTokens }) => [step, totalTokens]),
      [
        ['arbitration', 1100],
        ['narration', 1800],
        ['extraction', 900],
      ]
    )
  })

  test('tells how often a step was refused, and what refusals cost', ({ assert }) => {
    const refusedOnce = turn({
      llmUsage: [
        call('arbitration', 1, 1000, 0),
        call('narration', 1, 1000, 0),
        call('extraction', 1, 1000, 0),
        call('extraction', 2, 3000, 0),
      ],
      rejectedAttempts: [{ step: 'extraction', attempt: 1, output: {}, reasons: [] }],
    })

    const extraction = costReport([refusedOnce], FLAT).perStep.find(
      ({ step }) => step === 'extraction'
    )!

    assert.equal(extraction.calls, 2)
    assert.equal(extraction.rejectedCalls, 1)
    assert.equal(extraction.rejectionRate, 0.5)
    assert.equal(extraction.rejectedCostShare, 0.25)
  })

  test('reads rows logged before attempts were numbered as first attempts', ({ assert }) => {
    const legacy = turn({
      llmUsage: [{ step: 'arbitration', input_tokens: 10, output_tokens: 5, total_tokens: 15 }],
      rejectedAttempts: [{ step: 'arbitration', attempt: 1, output: {}, reasons: [] }],
    })

    const [arbitration] = costReport([legacy]).perStep

    assert.equal(arbitration.rejectedCalls, 1)
  })
})

test.group('Cost report | per language', () => {
  test('keeps languages apart, a turn in French costing what it costs', ({ assert }) => {
    const report = costReport([
      turn(),
      turn({ language: 'fr', llmUsage: [call('narration', 1, 2000, 600)] }),
      turn({ language: 'fr', llmUsage: [call('narration', 1, 2200, 600)] }),
    ])

    assert.deepEqual(
      report.perLanguage.map(({ language, turns, perTurn }) => [
        language,
        turns,
        perTurn.totalTokens,
      ]),
      [
        ['en', 1, 3800],
        ['fr', 2, 2700],
      ]
    )
  })
})
