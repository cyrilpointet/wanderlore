/*
|--------------------------------------------------------------------------
| Turn worker
|--------------------------------------------------------------------------
|
| Runs inside the HTTP process, started with the web server only — never in
| tests nor in console commands. One process to launch, and Transmit can
| broadcast from the job straight to the SSE connections of that same process.
|
| Does not scale past one instance: a separate worker would need Transmit's
| Redis transport, BullMQ and a lock per session (Phase 9).
|
*/

import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'

import queue from '#services/queue'
import turns from '#services/turn'
import { TurnWorker } from '#services/game/turn_worker'

const worker = new TurnWorker(queue, turns, {
  staleAfterMs: 5 * 60_000,
  sweepEveryMs: 60_000,
  logger,
})

await worker.start()

app.terminating(async () => {
  await worker.stop()
})
