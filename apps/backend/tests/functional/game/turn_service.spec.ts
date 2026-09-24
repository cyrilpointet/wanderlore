import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

import TurnLog from '#models/turn_log'
import Session from '#models/session'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { PLAY_TURN_QUEUE, TurnService } from '#services/game/turn_service'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import type { JobQueue } from '#services/queue/types'
import { ConcurrentTurnError, QueueUnavailableError, StaleTurnError } from '#services/game/errors'
import { TurnValidationError } from '#services/game/turn_validator'
import { FakeLlmProvider } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'
import { playerOf } from '#tests/helpers/turns'

/**
 * The pipeline end to end, with the model and the dice replaced. No network
 * call, and a roll that is chosen rather than drawn.
 */
const SETTLED = {
  intent: { type: 'observation', target: null, summary: 'Looking around the courtyard' },
  validity: { factual: true, plausibility: 'plausible', justification: 'Nothing prevents it.' },
  resolution: { mode: 'automatic_success', skill_used: null, difficulty: null },
  narration: 'The courtyard is empty but for a stable boy brushing down a grey mare.',
  effects: {
    movement: 'hotel_de_treville',
    scenario_flags: ['stable_boy_seen'],
    hit_points_delta: 0,
  },
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

const NEEDS_ROLL = {
  intent: { type: 'social_dialogue', target: 'guard', summary: 'Talking past the guard' },
  validity: { factual: true, plausibility: 'plausible', justification: 'The guard can be swayed.' },
  resolution: { mode: 'roll_required', skill_used: 'persuasion', difficulty: 'medium' },
  narration: null,
  effects: null,
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

const NARRATED = {
  narration: 'He weighs you for a long moment, then steps aside.',
  effects: { movement: 'louvre', scenario_flags: [], hit_points_delta: -1 },
}

async function arrangeScene() {
  const userId = await createUser()
  const sessionId = await createSession(userId)

  const character = await Character.create({
    sessionId,
    name: "d'Artagnan",
    skills: { persuasion: 3, swordsmanship: 2 },
    attributes: { social: 3 },
    resources: {},
    progression: {},
    hitPoints: 10,
    hitPointsMax: 10,
  })

  const worldState = await WorldState.create({
    sessionId,
    activeQuests: [],
    narrativeFlags: {},
    visitedLocations: [],
    worldObjects: [],
  })

  return { userId, sessionId, character, worldState }
}

/**
 * Faces are chosen so the roll lands where each spec needs it: 4 + 4 plus a
 * persuasion of 3 is 11 against the medium threshold of 9.
 */
function buildService(
  answers: unknown[],
  faces: number[] = [4, 4],
  queue: JobQueue = new MemoryQueue(),
  delayMs = 0
) {
  const provider = new FakeLlmProvider({ jsonSequence: answers, delayMs })
  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces))),
    queue
  )

  return { provider, service, queue, play: playerOf(service) }
}

function submission(sessionId: string, userId: string, playerInput = 'I look around.') {
  return { sessionId, userId, playerInput, idempotencyKey: randomUUID() }
}

test.group('TurnService | a settled turn', (group) => {
  useTransaction(group)

  test('resolves in a single call and applies its effects', async ({ assert }) => {
    const { sessionId, userId, worldState } = await arrangeScene()
    const { provider, play } = buildService([SETTLED])

    const result = await play({ sessionId, userId, playerInput: 'I look around.' })

    assert.lengthOf(provider.requests, 1)
    assert.equal(result.turnNumber, 1)
    assert.isNull(result.rollResult)

    await worldState.refresh()
    assert.deepEqual(worldState.narrativeFlags, { stable_boy_seen: true })
    assert.deepEqual(worldState.visitedLocations, [{ reference: 'hotel_de_treville' }])
  })

  test('logs the turn with its language and token usage', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { play } = buildService([SETTLED])

    await play({ sessionId, userId, playerInput: 'I look around.' })

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()

    assert.equal(turn.language, 'en')
    assert.equal(turn.narratedText, SETTLED.narration)
    assert.lengthOf(turn.llmUsage!, 1)
    assert.isNull(turn.rollResult)
  })

  test('numbers turns in sequence', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()

    await buildService([SETTLED]).play({ sessionId, userId, playerInput: 'I look around.' })
    const second = await buildService([SETTLED]).play({
      sessionId,
      userId,
      playerInput: 'I look again.',
    })

    assert.equal(second.turnNumber, 2)
  })
})

test.group('TurnService | a turn with a roll', (group) => {
  useTransaction(group)

  test('calls the model twice and resolves the roll in between', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { provider, play } = buildService([NEEDS_ROLL, NARRATED])

    const result = await play({
      sessionId,
      userId,
      playerInput: 'I ask him to let me pass.',
    })

    assert.lengthOf(provider.requests, 2)
    assert.equal(result.narratedText, NARRATED.narration)
    assert.equal(result.rollResult!.result, 'success')
    assert.equal(result.rollResult!.marginLabel, 'comfortable')
  })

  test('never sends the mechanics to the narrator', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { provider, play } = buildService([NEEDS_ROLL, NARRATED])

    await play({ sessionId, userId, playerInput: 'I ask him to let me pass.' })

    /**
     * The invariant the whole two-call split exists to protect, asserted on
     * what actually left the process rather than on the builder alone.
     */
    const narrationMessage = provider.requests[1].userMessage
    assert.notInclude(narrationMessage, 'threshold')
    assert.notInclude(narrationMessage, 'persuasion')
  })

  test('logs both calls and the dice that were rolled', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()

    await buildService([NEEDS_ROLL, NARRATED]).play({
      sessionId,
      userId,
      playerInput: 'I ask him to let me pass.',
    })

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()

    /**
     * The real cost of a turn is what it actually spent, across every call it
     * made.
     */
    assert.lengthOf(turn.llmUsage!, 2)
    assert.deepEqual(turn.rollResult!.dice, [4, 4])
  })

  test('applies the hit point loss the narration described', async ({ assert }) => {
    const { sessionId, userId, character } = await arrangeScene()

    await buildService([NEEDS_ROLL, NARRATED]).play({
      sessionId,
      userId,
      playerInput: 'I ask him to let me pass.',
    })

    await character.refresh()
    assert.equal(character.hitPoints, 9)
  })

  test('records the turn as completed and the session as active', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { lastActivityAt: before } = await Session.findOrFail(sessionId)

    await buildService([SETTLED]).play({ sessionId, userId, playerInput: 'I look around.' })

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()
    assert.equal(turn.status, 'completed')
    assert.isNull(turn.failure)

    /** The game list is sorted on it. */
    const session = await Session.findOrFail(sessionId)
    assert.isTrue(session.lastActivityAt > before)
  })

  test('records and returns the effects as applied, not as proposed', async ({ assert }) => {
    const { sessionId, userId, character } = await arrangeScene()
    character.hitPoints = 1
    await character.save()

    const result = await buildService([
      NEEDS_ROLL,
      { ...NARRATED, effects: { movement: null, scenario_flags: [], hit_points_delta: -3 } },
    ]).play({ sessionId, userId, playerInput: 'I ask him to let me pass.' })

    /**
     * Hit points stop at zero, so the player lost one, not three — and that is
     * what the journal must say.
     */
    assert.equal(result.appliedEffects!.hit_points_delta, -1)

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()
    assert.equal(turn.appliedEffects!.hit_points_delta, -1)
  })

  test('records no movement to where the character already stands', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()

    await buildService([SETTLED]).play({ sessionId, userId, playerInput: 'I look around.' })
    const second = await buildService([SETTLED]).play({
      sessionId,
      userId,
      playerInput: 'I look around again.',
    })

    assert.isNull(second.appliedEffects!.movement)
  })
})

test.group('TurnService | a turn that fails', (group) => {
  useTransaction(group)

  test('rejects a skill the character does not have', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { play } = buildService([
      { ...NEEDS_ROLL, resolution: { ...NEEDS_ROLL.resolution, skill_used: 'alchemy' } },
    ])

    const error = await play({ sessionId, userId, playerInput: 'I brew a potion.' })
      .then(() => null)
      .catch((caught) => caught)

    assert.instanceOf(error, TurnValidationError)
  })

  test('still logs the turn it could not finish', async ({ assert }) => {
    const { sessionId, userId, worldState } = await arrangeScene()
    const { play } = buildService([
      { ...NEEDS_ROLL, resolution: { ...NEEDS_ROLL.resolution, skill_used: 'alchemy' } },
    ])

    await play({ sessionId, userId, playerInput: 'I brew a potion.' }).catch(() => {})

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()

    /**
     * What makes a broken turn debuggable at all: the input that caused it and
     * the tokens it already cost, even though nothing was applied.
     */
    assert.equal(turn.playerInput, 'I brew a potion.')
    assert.lengthOf(turn.llmUsage!, 1)
    assert.isNull(turn.narratedText)
    assert.isNull(turn.appliedEffects)

    await worldState.refresh()
    assert.deepEqual(worldState.narrativeFlags, {})
  })

  test('records why it failed, as the player was told', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { play } = buildService([
      { ...NEEDS_ROLL, resolution: { ...NEEDS_ROLL.resolution, skill_used: 'alchemy' } },
    ])

    await play({ sessionId, userId, playerInput: 'I brew a potion.' }).catch(() => {})

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()

    /** A client that missed `turn_failed` reads the same code and message back. */
    assert.equal(turn.status, 'failed')
    assert.equal(turn.failure!.code, 'turn_validation_failed')
    assert.isString(turn.failure!.message)
  })

  test("keeps a failed turn out of the next turn's recent buffer", async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()

    await buildService([
      { ...NEEDS_ROLL, resolution: { ...NEEDS_ROLL.resolution, skill_used: 'alchemy' } },
    ])
      .play({ sessionId, userId, playerInput: 'I brew a potion.' })
      .catch(() => {})

    const next = buildService([SETTLED])
    const result = await next.play({ sessionId, userId, playerInput: 'I look around.' })

    /**
     * The failed turn is not part of the story: the model never hears of it,
     * and it takes no place in the numbering.
     */
    assert.notInclude(next.provider.requests[0].userMessage, 'I brew a potion.')
    assert.equal(result.turnNumber, 1)
  })

  test('leaves the state untouched when the narration call fails', async ({ assert }) => {
    const { sessionId, userId, character } = await arrangeScene()
    const { play } = buildService([NEEDS_ROLL, { narration: '', effects: NARRATED.effects }])

    await play({ sessionId, userId, playerInput: 'I ask him to let me pass.' }).catch(() => {})

    await character.refresh()
    assert.equal(character.hitPoints, 10)
  })
})

test.group('TurnService | submission', (group) => {
  useTransaction(group)

  test('records the turn as pending and queues it, without playing it', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const queue = new MemoryQueue()
    const { provider, service } = buildService([SETTLED], undefined, queue)

    const { turn } = await service.submit(submission(sessionId, userId))

    assert.equal(turn.status, 'pending')
    assert.isNull(turn.turnNumber)

    /** The job carries the turn's id and nothing else. */
    assert.deepEqual(queue.jobs, [{ queue: PLAY_TURN_QUEUE, payload: { turnId: turn.id } }])
    assert.lengthOf(provider.requests, 0)
  })

  test('fails the turn at once when it cannot be queued', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { service } = buildService([SETTLED], undefined, new UnreachableQueue())

    const error = await service
      .submit(submission(sessionId, userId))
      .then(() => null)
      .catch((caught) => caught)

    assert.instanceOf(error, QueueUnavailableError)

    /** No job will ever pick it up, so it must not wait as pending. */
    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()
    assert.equal(turn.status, 'failed')
    assert.equal(turn.failure!.code, 'turn_queue_unavailable')
  })
})

test.group('TurnService | a repeated submission', (group) => {
  useTransaction(group)

  test('returns the same turn and queues it only once', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const queue = new MemoryQueue()
    const { service } = buildService([SETTLED], undefined, queue)
    const sent = submission(sessionId, userId)

    const first = await service.submit(sent)
    const again = await service.submit(sent)

    assert.equal(again.turn.id, first.turn.id)
    assert.isFalse(first.replayed)
    assert.isTrue(again.replayed)

    /** The exit criterion of KAN-17: one turn, one job. */
    assert.lengthOf(queue.jobs, 1)
    assert.lengthOf(await TurnLog.query().where('sessionId', sessionId), 1)
  })

  test('hands back a played turn as it stands', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const queue = new MemoryQueue()
    const { provider, service } = buildService([SETTLED], undefined, queue)
    const sent = submission(sessionId, userId)

    const { turn } = await service.submit(sent)
    await service.run(turn.id)
    const again = await service.submit(sent)

    assert.equal(again.turn.status, 'completed')
    assert.lengthOf(queue.jobs, 1)
    assert.lengthOf(provider.requests, 1)
  })

  test('scopes a key to its game', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const other = await arrangeScene()
    const { service } = buildService([SETTLED, SETTLED])
    const sent = submission(sessionId, userId)

    const first = await service.submit(sent)
    const second = await service.submit({
      ...sent,
      sessionId: other.sessionId,
      userId: other.userId,
    })

    assert.notEqual(second.turn.id, first.turn.id)
    assert.isFalse(second.replayed)
  })
})

test.group('TurnService | turns left pending', (group) => {
  useTransaction(group)

  test('expires the turns pending since before the cutoff, and those only', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()
    const { service, play } = buildService([SETTLED])

    const stale = await service.record(submission(sessionId, userId))
    await db
      .from('turn_log')
      .where('id', stale.turn.id)
      .update({ created_at: DateTime.now().minus({ minutes: 10 }).toJSDate() })
    const fresh = await service.record(submission(sessionId, userId))
    const completed = await play({ sessionId, userId, playerInput: 'I look around.' })

    const expired = await service.expireStale(DateTime.now().minus({ minutes: 5 }))

    assert.deepEqual(expired, [stale.turn.id])

    await stale.turn.refresh()
    assert.equal(stale.turn.status, 'failed')
    assert.equal(stale.turn.failure!.code, 'turn_expired')

    await fresh.turn.refresh()
    assert.equal(fresh.turn.status, 'pending')

    await completed.refresh()
    assert.equal(completed.status, 'completed')
  })

  test('drops the outcome of a turn expired while it was being played', async ({ assert }) => {
    const { sessionId, userId, character } = await arrangeScene()
    const { provider, service } = buildService([NEEDS_ROLL, NARRATED], undefined, undefined, 50)
    const { turn } = await service.record(submission(sessionId, userId))

    const playing = service
      .run(turn.id)
      .then(() => null)
      .catch((caught) => caught)

    /** Expired once the model is answering — past every check made at the start. */
    while (provider.requests.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    await service.expireStale(DateTime.now().plus({ minutes: 1 }))

    assert.instanceOf(await playing, StaleTurnError)

    /**
     * The player was already told this turn failed. Completing it now would
     * tell them a second, different story — and apply effects they never saw.
     */
    await turn.refresh()
    assert.equal(turn.status, 'failed')
    assert.equal(turn.failure!.code, 'turn_expired')

    await character.refresh()
    assert.equal(character.hitPoints, 10)
  })
})

test.group('TurnService | two turns racing', (group) => {
  useTransaction(group)

  test('refuses the loser instead of crashing on the constraint', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()

    /**
     * Reproduces the real race rather than simulating it: both requests read
     * the last turn number before either has written, which is exactly what
     * happens when a player sends twice during the seconds a turn spends
     * waiting on the model.
     */
    const [first, second] = await Promise.allSettled([
      buildService([SETTLED]).play({
        sessionId,
        userId,
        playerInput: 'I look around.',
      }),
      buildService([SETTLED]).play({
        sessionId,
        userId,
        playerInput: 'I look around.',
      }),
    ])

    const outcomes = [first, second]
    assert.lengthOf(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      1
    )

    const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
    assert.instanceOf((rejected as PromiseRejectedResult).reason, ConcurrentTurnError)
  })

  test('logs the losing turn as failed and leaves the winner intact', async ({ assert }) => {
    const { sessionId, userId } = await arrangeScene()

    await Promise.allSettled([
      buildService([SETTLED]).play({ sessionId, userId, playerInput: 'I look around.' }),
      buildService([SETTLED]).play({ sessionId, userId, playerInput: 'I look around.' }),
    ])

    const turns = await TurnLog.query().where('sessionId', sessionId).orderBy('status')
    const completed = turns.filter((turn) => turn.status === 'completed')
    const failed = turns.filter((turn) => turn.status === 'failed')

    assert.lengthOf(completed, 1)
    assert.equal(completed[0].turnNumber, 1)

    /**
     * The loser was recorded at submission, so it stays in the log — failed,
     * with no number: that place in the story belongs to the winner.
     */
    assert.lengthOf(failed, 1)
    assert.isNull(failed[0].turnNumber)
    assert.equal(failed[0].failure!.code, 'turn_already_in_progress')
  })
})

/** A queue that cannot take a job, as when its database is out of reach. */
class UnreachableQueue extends MemoryQueue {
  async enqueue(): Promise<void> {
    throw new Error('connection refused')
  }
}
