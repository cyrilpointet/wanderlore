import { DateTime } from 'luxon'
import type { Logger } from '@adonisjs/core/logger'

import type { JobQueue } from '#services/queue/types'

import { PLAY_TURN_QUEUE, type PlayTurnJob, type TurnService } from './turn_service.js'

export type TurnWorkerOptions = {
  /**
   * Past this, a pending turn is taken for dead. Well above the longest a turn
   * can take — two model calls, each bounded by the gateway timeout — so the
   * sweep never expires a turn still being played.
   */
  staleAfterMs: number
  sweepEveryMs: number
  logger: Logger
}

/**
 * Plays queued turns, strictly one after the other, and expires the ones left
 * pending.
 *
 * `concurrency: 1` is what serialises turns at this phase: each one reads the
 * state the previous one left, and the race on the turn number disappears. It
 * is a property of this worker, never of the queue — and it only holds while
 * there is a single instance (Phase 9: a PostgreSQL lock per session).
 */
export class TurnWorker {
  #queue: JobQueue
  #turns: TurnService
  #options: TurnWorkerOptions
  #timer: NodeJS.Timeout | null = null

  constructor(queue: JobQueue, turns: TurnService, options: TurnWorkerOptions) {
    this.#queue = queue
    this.#turns = turns
    this.#options = options
  }

  async start(): Promise<void> {
    await this.#queue.start()

    /**
     * Swept before taking jobs: whatever was pending when the process last
     * stopped has had its chance.
     */
    await this.sweep()

    await this.#queue.work<PlayTurnJob>(PLAY_TURN_QUEUE, { concurrency: 1 }, (job) =>
      this.#play(job)
    )

    this.#timer = setInterval(() => {
      this.sweep().catch((error) =>
        this.#options.logger.error({ err: error }, 'sweeping stale turns failed')
      )
    }, this.#options.sweepEveryMs)
  }

  async stop(): Promise<void> {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }

    await this.#queue.stop()
  }

  /** Expires the turns pending for longer than `staleAfterMs`. */
  async sweep(now: DateTime = DateTime.now()): Promise<string[]> {
    const expired = await this.#turns.expireStale(
      now.minus({ milliseconds: this.#options.staleAfterMs })
    )

    if (expired.length > 0) {
      this.#options.logger.warn({ turnIds: expired }, 'expired turns left pending')
    }

    return expired
  }

  /**
   * A failed turn is not a failed job: the turn log already says what went
   * wrong, and there is no retry to trigger. Logged, then let go.
   */
  async #play({ turnId }: PlayTurnJob): Promise<void> {
    try {
      await this.#turns.run(turnId)
    } catch (error) {
      this.#options.logger.warn({ err: error, turnId }, 'turn failed')
    }
  }
}
