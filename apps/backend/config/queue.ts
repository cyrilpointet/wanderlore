import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { PgBossQueue } from '#services/queue/drivers/pg_boss_queue'
import type { JobQueue } from '#services/queue/types'

/**
 * The single place where the job queue is chosen.
 *
 * Moving to BullMQ, with several instances, means writing its adapter under
 * `app/services/queue/drivers/`, adding it here, and draining the queue before
 * switching. Nothing else in the application imports a queue library.
 */
function buildQueue(): JobQueue {
  if (env.get('QUEUE_DRIVER', 'pgboss') === 'memory') {
    return new MemoryQueue()
  }

  return new PgBossQueue({
    connection: {
      host: env.get('PG_HOST'),
      port: env.get('PG_PORT'),
      user: env.get('PG_USER'),
      password: env.get('PG_PASSWORD'),
      database: env.get('PG_DB_NAME'),
    },
    schema: 'pgboss',
    /** pg-boss's floor. Half a second at worst before a turn starts playing. */
    pollingIntervalSeconds: 0.5,
    onError: (error) => logger.error({ err: error }, 'job queue error'),
  })
}

const queueConfig = {
  driver: buildQueue(),
}

export default queueConfig
