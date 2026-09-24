import type { JobHandler, JobQueue, WorkOptions } from '../types.js'

export type QueuedJob = {
  queue: string
  payload: object
}

/**
 * In-process queue, for the test suite: no pg-boss, no database, and jobs that
 * can be inspected and run on demand.
 *
 * Jobs run one at a time whatever the concurrency asked for, which is the
 * strictest reading of it.
 */
export class MemoryQueue implements JobQueue {
  /** Every job ever enqueued, in order. */
  readonly jobs: QueuedJob[] = []

  #pending: QueuedJob[] = []
  #handlers = new Map<string, JobHandler<any>>()
  #started = false
  #draining: Promise<void> = Promise.resolve()

  async start(): Promise<void> {
    this.#started = true
    this.#schedule()
  }

  async stop(): Promise<void> {
    this.#started = false
    await this.#draining
  }

  async enqueue<TPayload extends object>(queue: string, payload: TPayload): Promise<void> {
    const job = { queue, payload }

    this.jobs.push(job)
    this.#pending.push(job)
    this.#schedule()
  }

  async work<TPayload extends object>(
    queue: string,
    _options: WorkOptions,
    handler: JobHandler<TPayload>
  ): Promise<void> {
    this.#handlers.set(queue, handler)
    this.#schedule()
  }

  /** Resolves once every job that can run has run. */
  async idle(): Promise<void> {
    await this.#draining
  }

  #schedule(): void {
    if (this.#started) {
      this.#draining = this.#draining.then(() => this.#drain())
    }
  }

  async #drain(): Promise<void> {
    let job: QueuedJob | undefined

    while ((job = this.#next())) {
      /** A handler failure is the handler's business, as with a real queue. */
      await this.#handlers.get(job.queue)!(job.payload).catch(() => {})
    }
  }

  #next(): QueuedJob | undefined {
    const index = this.#pending.findIndex((job) => this.#handlers.has(job.queue))

    return index === -1 ? undefined : this.#pending.splice(index, 1)[0]
  }
}
