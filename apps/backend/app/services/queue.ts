import queueConfig from '#config/queue'

/**
 * Application-wide job queue.
 *
 * Import this, never a queue library:
 *
 * ```ts
 * import queue from '#services/queue'
 * ```
 *
 * The test environment gets the in-memory driver (see `.env.test`).
 */
const queue = queueConfig.driver

export default queue

export type { JobHandler, JobQueue, WorkOptions } from './queue/types.js'
