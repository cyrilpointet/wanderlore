import type { Clock } from '#services/clock'

/**
 * Test double for the `Clock` port: time only moves when a spec moves it.
 *
 * Its timeout signals fire on `advance()`, never on their own, so a spec about
 * the turn budget runs in no time and cannot flake on a slow machine. Left
 * alone, it never moves at all: a spec that is not about time never runs out
 * of it.
 */
export class FakeClock implements Clock {
  /** Every duration a timeout was asked for, in order — assert on what the code requests. */
  readonly timeouts: number[] = []

  #now: number
  #pending: { at: number; controller: AbortController }[] = []

  constructor(start = Date.UTC(2026, 0, 1)) {
    this.#now = start
  }

  now(): number {
    return this.#now
  }

  timeout(ms: number): AbortSignal {
    this.timeouts.push(ms)

    const controller = new AbortController()
    this.#pending.push({ at: this.#now + ms, controller })

    return controller.signal
  }

  /** Moves time forward, firing every timeout it reaches. */
  advance(ms: number): void {
    this.#now += ms

    for (const timer of this.#pending.filter(({ at }) => at <= this.#now)) {
      timer.controller.abort(Object.assign(new Error('Timed out.'), { name: 'TimeoutError' }))
    }

    this.#pending = this.#pending.filter(({ at }) => at > this.#now)
  }
}
