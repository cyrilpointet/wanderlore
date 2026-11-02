/*
|--------------------------------------------------------------------------
| Turn and summary workers
|--------------------------------------------------------------------------
|
| Runs inside the HTTP process, started with the web server only — never in
| tests nor in console commands. One process to launch, and Transmit can
| broadcast from the job straight to the SSE connections of that same process.
|
| Summaries have a queue of their own, so writing one never holds up a turn.
|
| Does not scale past one instance: a separate worker would need Transmit's
| Redis transport, BullMQ and a lock per session (Phase 14).
|
*/

import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'

import queue from '#services/queue'
import turns from '#services/turn'
import summaries from '#services/summary'
import { TurnWorker } from '#services/game/turn_worker'
import { SummaryWorker } from '#services/game/summary_worker'

const worker = new TurnWorker(queue, turns, {
  staleAfterMs: 5 * 60_000,
  sweepEveryMs: 60_000,
  logger,
})

await worker.start()
/** After the turn worker, which starts the queue. */
await new SummaryWorker(queue, summaries, logger).start()

app.terminating(async () => {
  await worker.stop()
})
