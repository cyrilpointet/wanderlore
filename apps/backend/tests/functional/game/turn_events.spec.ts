import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'

import User from '#models/user'
import Character from '#models/character'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { ContentLabels } from '#services/game/content_labels'
import { THREE_MUSKETEERS } from '#services/game/world'
import { channelOf, toMessage } from '#services/game/turn_events'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { FakeLlmProvider } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { RecordingTurnEvents } from '#tests/helpers/recording_turn_events'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'

/**
 * The sequence of events a turn emits, required by the test strategy for
 * Phase 2 — without Transmit and without a model.
 */
const SETTLED = {
  intent: { type: 'observation', target: null, summary: 'Looking around' },
  validity: { factual: true, plausibility: 'plausible', justification: 'Nothing prevents it.' },
  resolution: { mode: 'automatic_success', skill_used: null, difficulty: null },
  narration: 'The street is quiet.',
  effects: { movement: 'paris', scenario_flags: ['street_seen'], hit_points_delta: 0 },
  alert: { prompt_injection_suspected: false, out_of_scope: false },
}

const NEEDS_ROLL = {
  ...SETTLED,
  resolution: { mode: 'roll_required', skill_used: 'persuasion', difficulty: 'medium' },
  narration: null,
  effects: null,
}

const NARRATED = {
  narration: 'The guard steps aside.',
  effects: { movement: null, scenario_flags: [], hit_points_delta: -2 },
}

const UNKNOWN_SKILL = {
  ...NEEDS_ROLL,
  resolution: { ...NEEDS_ROLL.resolution, skill_used: 'alchemy' },
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

function buildService(answers: unknown[], delayMs = 0) {
  const provider = new FakeLlmProvider({ jsonSequence: answers, delayMs })
  const events = new RecordingTurnEvents()
  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces([4, 4]))),
    new MemoryQueue(),
    events
  )

  return { provider, service, events }
}

async function playOne(answers: unknown[]) {
  const { userId, sessionId } = await arrangeScene()
  const { service, events } = buildService(answers)
  const idempotencyKey = randomUUID()

  const { turn } = await service.submit({
    sessionId,
    userId,
    playerInput: 'I look around.',
    idempotencyKey,
  })
  await service.run(turn.id).catch(() => {})

  return { turn, events, sessionId, idempotencyKey }
}

function terminals(sequence: string[]) {
  return sequence.filter((name) => name === 'turn_completed' || name === 'turn_failed')
}

test.group('Turn events | sequence', (group) => {
  useTransaction(group)

  test('without a roll: arbitration, then completed', async ({ assert }) => {
    const { turn, events } = await playOne([SETTLED])

    /**
     * Arbitration first even here: whether the turn needs a roll is only known
     * once that call has answered.
     */
    assert.deepEqual(events.sequenceOf(turn.id), ['step_started:arbitration', 'turn_completed'])
  })

  test('with a roll: arbitration, roll, narration, then completed', async ({ assert }) => {
    const { turn, events } = await playOne([NEEDS_ROLL, NARRATED])

    assert.deepEqual(events.sequenceOf(turn.id), [
      'step_started:arbitration',
      'roll_resolved',
      'step_started:narration',
      'turn_completed',
    ])
  })

  test('a turn rejected at arbitration ends failed', async ({ assert }) => {
    const { turn, events } = await playOne([UNKNOWN_SKILL])

    assert.deepEqual(events.sequenceOf(turn.id), ['step_started:arbitration', 'turn_failed'])
  })

  test('a turn rejected at narration ends failed, after its roll', async ({ assert }) => {
    const { turn, events } = await playOne([NEEDS_ROLL, { narration: '', effects: null }])

    assert.deepEqual(events.sequenceOf(turn.id), [
      'step_started:arbitration',
      'roll_resolved',
      'step_started:narration',
      'turn_failed',
    ])
  })

  test('every event names its turn and the key the front generated', async ({ assert }) => {
    const { turn, events, sessionId, idempotencyKey } = await playOne([NEEDS_ROLL, NARRATED])

    for (const { ref } of events.recorded) {
      assert.deepEqual(ref, { turnId: turn.id, sessionId, idempotencyKey })
    }
  })

  test('a turn that cannot be queued ends failed', async ({ assert }) => {
    const { userId, sessionId } = await arrangeScene()
    const events = new RecordingTurnEvents()
    const service = new TurnService(
      new LlmGateway(new FakeLlmProvider({}), { requestTimeoutMs: 1000 }),
      new RulesEngine(new DiceService(FakeRandomSource.fromFaces([4, 4]))),
      new UnreachableQueue(),
      events
    )

    await service
      .submit({ sessionId, userId, playerInput: 'I look around.', idempotencyKey: randomUUID() })
      .catch(() => {})

    assert.deepEqual(
      events.recorded.map(({ event }) => event.type),
      ['turn_failed']
    )
  })

  test('an expired turn ends failed, once, even if it was still playing', async ({ assert }) => {
    const { userId, sessionId } = await arrangeScene()
    const { provider, service, events } = buildService([NEEDS_ROLL, NARRATED], 50)
    const { turn } = await service.record({
      sessionId,
      userId,
      playerInput: 'I look around.',
      idempotencyKey: randomUUID(),
    })

    const playing = service.run(turn.id).catch(() => {})
    while (provider.requests.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    await service.expireStale(DateTime.now().plus({ minutes: 1 }))
    await playing

    /**
     * The sweep told the player; the run that finished afterwards must not tell
     * them a second time, nor that it completed.
     */
    const sequence = events.sequenceOf(turn.id)
    assert.deepEqual(terminals(sequence), ['turn_failed'])
  })

  test('exactly one terminal event per turn, whatever the path', async ({ assert }) => {
    for (const answers of [[SETTLED], [NEEDS_ROLL, NARRATED], [UNKNOWN_SKILL], []]) {
      const { turn, events } = await playOne(answers)

      assert.lengthOf(terminals(events.sequenceOf(turn.id)), 1)
    }
  })
})

test.group('Turn events | what goes over the wire', (group) => {
  useTransaction(group)

  const labels = new ContentLabels(THREE_MUSKETEERS)

  test('a roll carries its labelled skill and qualitative outcome, never a number', async ({
    assert,
  }) => {
    const { turn, events } = await playOne([NEEDS_ROLL, NARRATED])
    const roll = events.recorded.find(({ event }) => event.type === 'roll_resolved')!

    const message = toMessage(roll.ref, roll.event, labels)

    assert.deepEqual(message, {
      event: 'roll_resolved',
      turnId: turn.id,
      idempotencyKey: roll.ref.idempotencyKey,
      skill: { reference: 'persuasion', label: 'Persuasion' },
      result: 'success',
      margin: 'comfortable',
    })
  })

  test('a completed turn carries the journal entry and the updated sheet', async ({ assert }) => {
    const { events } = await playOne([NEEDS_ROLL, NARRATED])
    const completed = events.recorded.find(({ event }) => event.type === 'turn_completed')!

    const message = toMessage(completed.ref, completed.event, labels) as Record<string, any>

    /** Enough to update both without a further request. */
    assert.equal(message.turn.narration, NARRATED.narration)
    assert.equal(message.turn.status, 'completed')
    assert.deepEqual(message.turn.effects, { hitPointsDelta: -2, movement: null })
    assert.equal(message.character.hitPoints, 8)
    assert.deepEqual(message.character.skills[0].label, 'Persuasion')
  })

  test('nothing mechanical or internal leaves in any event', async ({ assert }) => {
    const { events } = await playOne([SETTLED])
    const second = await playOne([NEEDS_ROLL, NARRATED])

    const wire = JSON.stringify(
      [...events.recorded, ...second.events.recorded].map(({ ref, event }) =>
        toMessage(ref, event, labels)
      )
    )

    for (const leak of ['dice', 'threshold', 'total', 'skillValue', 'street_seen']) {
      assert.notInclude(wire, leak)
    }
  })

  test('a failure carries the code and message the player reads', async ({ assert }) => {
    const { turn, events } = await playOne([UNKNOWN_SKILL])
    const failed = events.recorded.find(({ event }) => event.type === 'turn_failed')!

    const message = toMessage(failed.ref, failed.event, labels) as Record<string, any>

    assert.equal(message.turnId, turn.id)
    assert.equal(message.failure.code, 'turn_validation_failed')
    assert.isString(message.failure.message)
    assert.notProperty(message.failure, 'reasons')
  })
})

test.group('Turn events | channel access', (group) => {
  useTransaction(group)

  async function canSubscribe(user: User | undefined, sessionId: string) {
    const context = { auth: { user } } as unknown as HttpContext

    return transmit.getManager().verifyAccess(channelOf(sessionId), context)
  }

  test("opens a game's channel to its player", async ({ assert }) => {
    const player = await User.findOrFail(await createUser())
    const sessionId = await createSession(player.id)

    assert.isTrue(await canSubscribe(player, sessionId))
  })

  test('closes it to anyone else, and to a malformed id', async ({ assert }) => {
    const intruder = await User.findOrFail(await createUser())
    const sessionId = await createSession(await createUser())

    assert.isFalse(await canSubscribe(intruder, sessionId))
    assert.isFalse(await canSubscribe(intruder, 'not-a-uuid'))
    assert.isFalse(await canSubscribe(undefined, sessionId))
  })

  test('refuses an anonymous subscription outright', async ({ client }) => {
    const sessionId = await createSession(await createUser())

    const response = await client
      .post('/__transmit/subscribe')
      .json({ uid: randomUUID(), channel: channelOf(sessionId) })
      .withCsrfToken()

    response.assertStatus(401)
  })
})

/** A queue that cannot take a job, as when its database is out of reach. */
class UnreachableQueue extends MemoryQueue {
  async enqueue(): Promise<void> {
    throw new Error('connection refused')
  }
}
