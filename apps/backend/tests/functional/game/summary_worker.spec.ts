import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

import { LlmGateway } from '#services/llm/gateway'
import { SUMMARISE_QUEUE, SummaryService } from '#services/game/summary_service'
import { SummaryWorker } from '#services/game/summary_worker'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { FakeLlmProvider, rawAnswer } from '#tests/helpers/fake_llm_provider'
import { countRows, createSession, createUser, useTransaction } from '#tests/helpers/database'

async function arrangeGame(turns: number) {
  const sessionId = await createSession(await createUser())

  for (let number = 1; number <= turns; number++) {
    await db.table('turn_log').insert({
      session_id: sessionId,
      turn_number: number,
      status: 'completed',
      player_input: `Action ${number}`,
      narrated_text: `Narration ${number}`,
      created_at: new Date(),
    })
  }

  return sessionId
}

async function startWorker(provider: FakeLlmProvider) {
  const queue = new MemoryQueue()
  const service = new SummaryService(new LlmGateway(provider, { requestTimeoutMs: 1000 }))

  await queue.start()
  await new SummaryWorker(queue, service, logger).start()

  return queue
}

/**
 * The worker on the in-memory queue: a job carries a game, the summary is
 * written from it. pg-boss itself is never started in the suite.
 */
test.group('SummaryWorker', (group) => {
  useTransaction(group)

  test('writes the summary a job asks for', async ({ assert }) => {
    const sessionId = await arrangeGame(12)
    const queue = await startWorker(new FakeLlmProvider({ jsonSequence: [rawAnswer('Paris.')] }))

    await queue.enqueue(SUMMARISE_QUEUE, { sessionId })
    await queue.idle()

    assert.equal(await countRows('narrative_summaries', { session_id: sessionId }), 1)
  })

  test('lets a failed summary go, and takes the next job', async ({ assert }) => {
    const failing = await arrangeGame(12)
    const next = await arrangeGame(12)
    const queue = await startWorker(
      new FakeLlmProvider({ jsonSequence: [rawAnswer(''), rawAnswer('Paris.')] })
    )

    await queue.enqueue(SUMMARISE_QUEUE, { sessionId: failing })
    await queue.enqueue(SUMMARISE_QUEUE, { sessionId: next })
    await queue.idle()

    assert.equal(await countRows('narrative_summaries', { session_id: failing }), 0)
    assert.equal(await countRows('narrative_summaries', { session_id: next }), 1)
  })
})
