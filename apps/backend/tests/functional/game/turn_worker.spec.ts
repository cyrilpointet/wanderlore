import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

import TurnLog from '#models/turn_log'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { TurnWorker } from '#services/game/turn_worker'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { FakeLlmProvider } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'

/**
 * The worker end to end, on the in-memory queue: a submission answered at
 * once, then played in a job. pg-boss itself is never started in the suite.
 */
const SETTLED = {
  intent: { type: 'observation', target: null, summary: 'Looking around' },
  validity: { factual: true, plausibility: 'plausible', justification: 'Nothing prevents it.' },
  resolution: { mode: 'automatic_success', skill_used: null, difficulty: null },
  narration: 'The street is quiet.',
  effects: { movement: null, scenario_flags: [], hit_points_delta: 0 },
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

const INVALID = {
  ...SETTLED,
  resolution: { mode: 'roll_required', skill_used: 'alchemy', difficulty: 'medium' },
  narration: null,
  effects: null,
}

async function arrangeScene() {
  const userId = await createUser()
  const sessionId = await createSession(userId)

  await Character.create({
    sessionId,
    name: "d'Artagnan",
    skills: { persuasion: 3 },
    attributes: { social: 3 },
    resources: {},
    progression: {},
    hitPoints: 10,
    hitPointsMax: 10,
  })

  await WorldState.create({
    sessionId,
    activeQuests: [],
    narrativeFlags: {},
    visitedLocations: [],
    worldObjects: [],
  })

  return { userId, sessionId }
}

function buildWorker(answers: unknown[]) {
  const queue = new MemoryQueue()
  const service = new TurnService(
    new LlmGateway(new FakeLlmProvider({ jsonSequence: answers }), { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces([4, 4]))),
    queue
  )
  const worker = new TurnWorker(queue, service, {
    staleAfterMs: 5 * 60_000,
    sweepEveryMs: 60_000,
    logger,
  })

  return { queue, service, worker }
}

function submission(sessionId: string, userId: string, playerInput = 'I look around.') {
  return { sessionId, userId, playerInput, idempotencyKey: randomUUID() }
}

test.group('TurnWorker', (group) => {
  useTransaction(group)

  test('plays a submitted turn to completion, in the background', async ({ assert, cleanup }) => {
    const { sessionId, userId } = await arrangeScene()
    const { queue, service, worker } = buildWorker([SETTLED])
    await worker.start()
    cleanup(() => worker.stop())

    const { turn } = await service.submit(submission(sessionId, userId))
    await queue.idle()

    await turn.refresh()
    assert.equal(turn.status, 'completed')
    assert.equal(turn.turnNumber, 1)
    assert.equal(turn.narratedText, SETTLED.narration)
  })

  test('logs a turn that fails, and keeps working', async ({ assert, cleanup }) => {
    const { sessionId, userId } = await arrangeScene()
    const { queue, service, worker } = buildWorker([INVALID, SETTLED])
    await worker.start()
    cleanup(() => worker.stop())

    const failing = await service.submit(submission(sessionId, userId, 'I brew a potion.'))
    const next = await service.submit(submission(sessionId, userId))
    await queue.idle()

    /** The exit criterion: turn_log is written, failure included. */
    await failing.turn.refresh()
    assert.equal(failing.turn.status, 'failed')
    assert.equal(failing.turn.failure!.code, 'turn_validation_failed')

    await next.turn.refresh()
    assert.equal(next.turn.status, 'completed')
  })

  test('plays the turns of a game one after the other', async ({ assert, cleanup }) => {
    const { sessionId, userId } = await arrangeScene()
    const { queue, service, worker } = buildWorker([SETTLED, SETTLED])
    await worker.start()
    cleanup(() => worker.stop())

    /**
     * Submitted back to back, as a quick double send would: run concurrently
     * they would race on the turn number, serialised they simply follow on.
     */
    await Promise.all([
      service.submit(submission(sessionId, userId)),
      service.submit(submission(sessionId, userId)),
    ])
    await queue.idle()

    const turns = await TurnLog.query().where('sessionId', sessionId).orderBy('turnNumber')
    assert.deepEqual(
      turns.map((turn) => [turn.status, turn.turnNumber]),
      [
        ['completed', 1],
        ['completed', 2],
      ]
    )
  })

  test('expires what was left pending before it starts', async ({ assert, cleanup }) => {
    const { sessionId, userId } = await arrangeScene()
    const { service, worker } = buildWorker([])

    const { turn } = await service.record(submission(sessionId, userId))
    await db
      .from('turn_log')
      .where('id', turn.id)
      .update({ created_at: DateTime.now().minus({ minutes: 10 }).toJSDate() })

    await worker.start()
    cleanup(() => worker.stop())

    await turn.refresh()
    assert.equal(turn.status, 'failed')
    assert.equal(turn.failure!.code, 'turn_expired')
  })
})
