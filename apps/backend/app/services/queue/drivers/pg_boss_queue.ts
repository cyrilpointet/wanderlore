import { PgBoss } from 'pg-boss'

import type { JobHandler, JobQueue, WorkOptions } from '../types.js'

export type PgBossQueueOptions = {
  connection: {
    host: string
    port: number
    user: string
    password?: string
    database: string
  }
  /** Where pg-boss keeps its tables — outside `public`, which Lucid owns. */
  schema: string
  /**
   * How long an idle worker waits before looking for a job again. pg-boss
   * polls rather than being notified, so this is the delay a player may wait
   * before their turn even starts.
   */
  pollingIntervalSeconds: number
  onError: (error: Error) => void
}

/**
 * Job queue backed by PostgreSQL: no Redis to host while there is a single
 * instance.
 */
export class PgBossQueue implements JobQueue {
  #boss: PgBoss
  #options: PgBossQueueOptions
  #created = new Set<string>()

  constructor(options: PgBossQueueOptions) {
    this.#options = options
    this.#boss = new PgBoss({
      ...options.connection,
      schema: options.schema,
      application_name: 'wanderlore-queue',
    })

    /** An unhandled `error` event would take the whole process down. */
    this.#boss.on('error', options.onError)
  }

  async start(): Promise<void> {
    await this.#boss.start()
  }

  async stop(): Promise<void> {
    await this.#boss.stop({ graceful: true })
  }

  async enqueue<TPayload extends object>(queue: string, payload: TPayload): Promise<void> {
    await this.#ensureQueue(queue)

    const id = await this.#boss.send(queue, payload)

    if (id === null) {
      throw new Error(`pg-boss refused a job for queue "${queue}".`)
    }
  }

  async work<TPayload extends object>(
    queue: string,
    options: WorkOptions,
    handler: JobHandler<TPayload>
  ): Promise<void> {
    await this.#ensureQueue(queue)

    await this.#boss.work<TPayload>(
      queue,
      {
        localConcurrency: options.concurrency,
        batchSize: 1,
        pollingIntervalSeconds: this.#options.pollingIntervalSeconds,
      },
      async ([job]) => {
        await handler(job.data)
      }
    )
  }

  /**
   * pg-boss wants a queue declared before it is used. Declared here, on first
   * use, so the port stays free of a separate declaration step BullMQ has no
   * use for.
   */
  async #ensureQueue(queue: string): Promise<void> {
    if (this.#created.has(queue)) {
      return
    }

    if (!(await this.#boss.getQueue(queue))) {
      /** No retry: a failed turn reaches the player, who decides to try again. */
      await this.#boss.createQueue(queue, { retryLimit: 0 })
    }

    this.#created.add(queue)
  }
}
