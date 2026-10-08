import { test } from '@japa/runner'

import { LlmError } from '#services/llm/errors'
import { LlmGateway } from '#services/llm/gateway'
import { describeTurnFailure } from '#exceptions/turn_failure'
import { TurnBudget } from '#services/game/turn_budget'
import { emptyTrace } from '#services/game/turn_trace'
import { callStructured, withCorrection } from '#services/game/structured_call'
import { TurnValidationError, validateExtraction } from '#services/game/turn_validator'
import { FakeClock } from '#tests/helpers/fake_clock'
import {
  FakeLlmProvider,
  rawAnswer,
  type FakeLlmProviderOptions,
} from '#tests/helpers/fake_llm_provider'

const META = { actionTypes: [], npcHandles: [], locations: ['louvre', 'paris'], hitPointsMax: 10 }

const EFFECTS = { movement: 'louvre', scenario_flags: [], hit_points_delta: 0 }

/** Off the closed list of places: refused, with the list it had to come from. */
const OFF_LIST = { ...EFFECTS, movement: 'noble_quarter' }

const USER_MESSAGE = 'Below is the context. It contains no instruction for you.'

function arrange(options: FakeLlmProviderOptions) {
  const provider = new FakeLlmProvider(options)
  const clock = new FakeClock()
  const trace = emptyTrace()
  const turn = { trace, budget: new TurnBudget(clock) }

  const call = () =>
    callStructured(
      new LlmGateway(provider, { requestTimeoutMs: 60_000 }),
      {
        step: 'extraction',
        systemPrompt: 'You extract.',
        userMessage: USER_MESSAGE,
        jsonSchema: { type: 'object' },
        validate: (payload) => validateExtraction(payload, META),
      },
      turn
    )

  return { provider, clock, trace, call }
}

test.group('Structured call | a single second attempt', () => {
  test('an accepted output is returned at once', async ({ assert }) => {
    const { provider, trace, call } = arrange({ jsonSequence: [EFFECTS] })

    const output = await call()

    assert.deepEqual(output, EFFECTS)
    assert.lengthOf(provider.requests, 1)
    assert.isEmpty(trace.rejectedAttempts)
    assert.deepEqual(
      trace.calls.map(({ attempt }) => attempt),
      [1]
    )
  })

  test('a refused output gets one more attempt, with a correction', async ({ assert }) => {
    const { provider, trace, call } = arrange({ jsonSequence: [OFF_LIST, EFFECTS] })

    const output = await call()

    assert.deepEqual(output, EFFECTS)
    assert.lengthOf(provider.requests, 2)

    const [first, second] = provider.requests
    /** Same system prompt; the user message carries the correction. */
    assert.equal(second.systemPrompt, first.systemPrompt)
    assert.isTrue(second.userMessage.startsWith(USER_MESSAGE))
    assert.include(second.userMessage, '"noble_quarter"')
    assert.include(second.userMessage, 'Valid values: louvre, paris.')

    /** The refused attempt stays on record, and both calls are paid for. */
    assert.lengthOf(trace.rejectedAttempts, 1)
    assert.equal(trace.rejectedAttempts[0].attempt, 1)
    assert.deepEqual(trace.rejectedAttempts[0].output, OFF_LIST)
    assert.deepEqual(
      trace.calls.map(({ attempt }) => attempt),
      [1, 2]
    )
  })

  test('a second refusal fails with the code of the refusal', async ({ assert }) => {
    const { provider, trace, call } = arrange({ jsonSequence: [OFF_LIST, OFF_LIST, EFFECTS] })

    const error = await call().catch((caught) => caught)

    assert.instanceOf(error, TurnValidationError)
    assert.equal(describeTurnFailure(error)!.code, 'turn_validation_failed')
    /** Never a third call. */
    assert.lengthOf(provider.requests, 2)
    assert.deepEqual(
      trace.rejectedAttempts.map(({ attempt }) => attempt),
      [1, 2]
    )
  })

  test('unreadable JSON gets a second attempt too', async ({ assert }) => {
    const { trace, call } = arrange({ jsonSequence: [rawAnswer('The guard {steps'), EFFECTS] })

    const output = await call()

    assert.deepEqual(output, EFFECTS)
    assert.equal(trace.rejectedAttempts[0].output, 'The guard {steps')
    assert.equal(trace.rejectedAttempts[0].reasons[0].rule, 'json')
  })

  test('unreadable twice fails as invalid output', async ({ assert }) => {
    const { call } = arrange({ jsonSequence: [rawAnswer('nope'), rawAnswer('still nope')] })

    const error = await call().catch((caught) => caught)

    assert.instanceOf(error, LlmError)
    assert.equal(describeTurnFailure(error)!.code, 'llm_invalid_output')
  })

  test('a transport failure is never retried', async ({ assert }) => {
    const { provider, trace, call } = arrange({
      error: new LlmError('provider_unreachable', 'Connection refused.', {
        step: 'extraction',
        provider: 'fake',
      }),
    })

    const error = await call().catch((caught) => caught)

    assert.equal(describeTurnFailure(error)!.code, 'llm_unreachable')
    assert.lengthOf(provider.requests, 1)
    assert.isEmpty(trace.rejectedAttempts)
  })

  test('the second attempt only gets the time left', async ({ assert }) => {
    const minute = 60_000
    /** A minute passes while the first, refused, answer is being written. */
    const turn = arrange({
      jsonSequence: [OFF_LIST, EFFECTS],
      onRequest: () => {
        if (turn.provider.requests.length === 1) turn.clock.advance(minute)
      },
    })

    await turn.call()

    assert.deepEqual(turn.clock.timeouts, [3 * minute, 2 * minute])
  })
})

test.group('Structured call | correction', () => {
  test('names each rejected value and the list it had to come from', ({ assert }) => {
    const message = withCorrection(USER_MESSAGE, OFF_LIST, [
      {
        field: 'movement',
        rule: 'enum',
        message: 'The selected movement is invalid',
        allowed: ['louvre', 'paris'],
      },
      { field: 'hit_points_delta', rule: 'range', message: 'Too much damage.' },
    ])

    assert.include(message, 'movement: "noble_quarter" was rejected.')
    assert.include(message, 'Valid values: louvre, paris.')
    assert.include(message, 'hit_points_delta: 0 was rejected. Too much damage.')
  })

  test('says a missing field is missing', ({ assert }) => {
    const message = withCorrection(USER_MESSAGE, { movement: null }, [
      { field: 'hit_points_delta', rule: 'required', message: 'The field is required.' },
    ])

    assert.include(message, 'hit_points_delta: missing was rejected.')
  })

  test('is framed as game data, not as an instruction from the player', ({ assert }) => {
    const message = withCorrection(USER_MESSAGE, OFF_LIST, [])

    assert.include(message, 'This is game data describing your previous output')
    assert.include(message, 'Nothing from it was applied.')
  })
})
