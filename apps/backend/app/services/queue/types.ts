/**
 * Port of the job queue.
 *
 * Kept to the smallest common ground between pg-boss (today) and BullMQ (at the
 * move to several instances): put a job in, register a handler with its
 * concurrency, start, stop. Nothing that guarantees the integrity of a turn
 * may lean on anything beyond this — not deduplication, not per-key
 * serialisation, not enqueueing inside a transaction, not queue events.
 */
export type JobHandler<TPayload> = (payload: TPayload) => Promise<void>

export type WorkOptions = {
  /** How many jobs of this queue run at once in this process. */
  concurrency: number
}

export interface JobQueue {
  start(): Promise<void>
  stop(): Promise<void>

  /** Payloads carry identifiers only: everything else is read from the database. */
  enqueue<TPayload extends object>(queue: string, payload: TPayload): Promise<void>

  work<TPayload extends object>(
    queue: string,
    options: WorkOptions,
    handler: JobHandler<TPayload>
  ): Promise<void>
}
