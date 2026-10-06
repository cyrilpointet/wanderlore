import { test } from '@japa/runner'

import { LlmError } from '#services/llm/errors'
import { LlmGateway } from '#services/llm/gateway'
import { describeTurnFailure } from '#exceptions/turn_failure'
import { TURN_BUDGET_MS, TurnBudget } from '#services/game/turn_budget'
import { FakeClock } from '#tests/helpers/fake_clock'
import { FakeLlmProvider } from '#tests/helpers/fake_llm_provider'

const MINUTE = 60_000

test.group('Turn budget', () => {
  test('starts with three minutes', ({ assert }) => {
    const budget = new TurnBudget(new FakeClock())

    assert.equal(TURN_BUDGET_MS, 3 * MINUTE)
    assert.equal(budget.remainingMs(), TURN_BUDGET_MS)
  })

  test('hands each call a signal bounded by the time left', ({ assert }) => {
    const clock = new FakeClock()
    const budget = new TurnBudget(clock)

    budget.signalFor('arbitration', 'fake')
    clock.advance(MINUTE + 500)
    budget.signalFor('narration', 'fake')

    assert.deepEqual(clock.timeouts, [TURN_BUDGET_MS, 2 * MINUTE - 500])
  })

  test('aborts the call in flight when the turn runs out of time', ({ assert }) => {
    const clock = new FakeClock()
    const budget = new TurnBudget(clock)
    clock.advance(2 * MINUTE)

    const signal = budget.signalFor('narration', 'fake')
    clock.advance(MINUTE - 1)
    assert.isFalse(signal.aborted)

    clock.advance(1)
    assert.isTrue(signal.aborted)
  })

  test('refuses a call once nothing is left, as a timeout', ({ assert }) => {
    const clock = new FakeClock()
    const budget = new TurnBudget(clock)
    clock.advance(TURN_BUDGET_MS + MINUTE)

    assert.equal(budget.remainingMs(), 0)

    try {
      budget.signalFor('extraction', 'fake')
      assert.fail('The call should have been refused.')
    } catch (error) {
      assert.instanceOf(error, LlmError)
      assert.equal((error as LlmError).category, 'timeout')
      assert.equal((error as LlmError).step, 'extraction')
      /** The code the front already knows how to show. */
      assert.equal(describeTurnFailure(error)!.code, 'llm_timeout')
    }
  })
})

test.group('Turn budget | through the gateway', () => {
  test('a call cut by the budget fails as a timeout', async ({ assert }) => {
    const clock = new FakeClock()
    const budget = new TurnBudget(clock)
    const provider = new FakeLlmProvider({
      text: 'too late',
      /** The turn runs out of time while the model is answering. */
      onRequest: () => clock.advance(TURN_BUDGET_MS),
    })
    const gateway = new LlmGateway(provider, { requestTimeoutMs: 60_000 })

    await assert.rejects(
      () =>
        gateway.generateText('narration', {
          systemPrompt: 'system',
          userMessage: 'user',
          signal: budget.signalFor('narration', provider.name),
        }),
      LlmError
    )
    assert.lengthOf(provider.requests, 1)
  })
})
