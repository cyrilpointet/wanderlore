import type { Logger } from '@adonisjs/core/logger'

import type { JobQueue } from '#services/queue/types'

import { SUMMARISE_QUEUE, type SummariseJob, type SummaryService } from './summary_service.js'

/**
 * Writes the summaries the turns ask for, from a queue of its own: the turn
 * worker plays one turn at a time, and a summary in its queue would hold up
 * the next turn of every player.
 *
 * `concurrency: 1` here too: two summaries of the same game must not race
 * for the same range. Expects the queue started — by the turn worker.
 */
export class SummaryWorker {
  #queue: JobQueue
  #summaries: SummaryService
  #logger: Logger

  constructor(queue: JobQueue, summaries: SummaryService, logger: Logger) {
    this.#queue = queue
    this.#summaries = summaries
    this.#logger = logger
  }

  async start(): Promise<void> {
    await this.#queue.work<SummariseJob>(SUMMARISE_QUEUE, { concurrency: 1 }, (job) =>
      this.#summarise(job)
    )
  }

  /**
   * A failed summary is not a failed job: nothing was written, and the next
   * turn asks again. Logged, then let go.
   */
  async #summarise({ sessionId }: SummariseJob): Promise<void> {
    try {
      await this.#summaries.summarise(sessionId)
    } catch (error) {
      this.#logger.warn({ err: error, sessionId }, 'summary failed')
    }
  }
}
