import type { Clock } from '#services/clock'
import { LlmError } from '#services/llm/errors'
import type { LlmStep } from '#services/llm/types'

/**
 * How long a turn may run once a worker has picked it up.
 *
 * Three calls and two retries at a full call timeout each would reach the
 * five minutes after which the sweep expires a pending turn. Bounding the turn
 * itself keeps the sweep from ever catching a live one: three minutes at most,
 * two left for the wait in the queue.
 */
export const TURN_BUDGET_MS = 3 * 60_000

/**
 * The time a turn has left, counted from the moment it started playing.
 *
 * Each model call gets a signal bounded by what remains. The gateway combines
 * it with its own per-call timeout, so a call runs for the shorter of the two
 * — and a retry only ever gets what is left.
 */
export class TurnBudget {
  #clock: Clock
  #budgetMs: number
  #deadline: number

  constructor(clock: Clock, budgetMs = TURN_BUDGET_MS) {
    this.#clock = clock
    this.#budgetMs = budgetMs
    this.#deadline = clock.now() + budgetMs
  }

  remainingMs(): number {
    return Math.max(0, this.#deadline - this.#clock.now())
  }

  /**
   * The signal for the next call of `step`.
   *
   * With nothing left, the turn fails as a timeout on the spot: the call
   * never reaches the provider, and is never paid for.
   */
  signalFor(step: LlmStep, provider: string): AbortSignal {
    const remaining = this.remainingMs()

    if (remaining === 0) {
      throw new LlmError(
        'timeout',
        `The turn used up its ${this.#budgetMs}ms budget before the ${step} call.`,
        { step, provider }
      )
    }

    return this.#clock.timeout(remaining)
  }
}
