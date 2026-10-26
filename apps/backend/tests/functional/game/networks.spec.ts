import { test } from '@japa/runner'

import Character from '#models/character'
import TurnLog from '#models/turn_log'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { visitUniqueLocation } from '#services/game/locations'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { HOUSE_WORLD } from '#tests/helpers/places'
import { GASCON } from '#tests/helpers/worlds'
import { seedHouse } from '#tests/helpers/content'
import { FakeLlmProvider, streamed } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { FakeClock } from '#tests/helpers/fake_clock'
import { RecordingTurnEvents } from '#tests/helpers/recording_turn_events'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'
import { extracted, playerOf } from '#tests/helpers/turns'

/**
 * Turns played inside a network of places: the house of the specs, gone
 * through room by room, with the model replaced.
 */

/** A ruling that settles a movement, to `destination` when it names one. */
function going(destination: string | null, duration: Record<string, unknown> = {}) {
  return {
    intent: { type: 'movement', target: null, summary: 'Going on', destination },
    validity: { factual: true, plausibility: 'plausible', justification: 'Nothing prevents it.' },
    resolution: { mode: 'automatic_success', action_type: null, difficulty: null },
    duration: { label: 'moment', count: null, period: null, ...duration },
    alert: { prompt_injection_suspected: false, out_of_scope: false },
  }
}

function buildService(answers: unknown[]) {
  const provider = new FakeLlmProvider({ jsonSequence: answers })
  const events = new RecordingTurnEvents()
  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces([30]))),
    new MemoryQueue(),
    events,
    new FakeClock()
  )

  return { provider, events, play: playerOf(service) }
}

/**
 * D'Artagnan in the hall of the house at four in the afternoon, having come
 * in by the yard: the rest of the house is still to discover.
 */
async function arrangeHall(visited: string[] = ['house_yard', 'house_hall']) {
  const content = await seedHouse()
  const userId = await createUser()
  const sessionId = await createSession(userId, content)

  await Character.create({
    sessionId,
    name: "d'Artagnan",
    skills: { persuasion: 60 },
    characteristics: GASCON,
    resources: {},
    progression: {},
    hitPoints: 10,
    hitPointsMax: 10,
  })

  let hall = null
  for (const reference of visited) {
    const instance = await visitUniqueLocation(HOUSE_WORLD, sessionId, reference)
    hall = reference === 'house_hall' ? instance : hall
  }

  const worldState = await WorldState.create({
    sessionId,
    currentLocationId: hall!.id,
    activeQuests: [],
    narrativeFlags: {},
    gameTime: 16 * 3600,
  })

  return { userId, sessionId, worldState }
}

const playerInput = 'I go up the stairs.'

test.group('Networks | arbitration and narration', (group) => {
  useTransaction(group)

  test('arbitration is handed the hall, its exits and where they lead', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const { provider, play } = buildService([
      going('house_corridor'),
      streamed('You climb the main staircase.'),
      extracted({ movement: 'house_corridor' }),
    ])

    await play({ sessionId, userId, playerInput })

    const arbitration = provider.requests.find(({ step }) => step === 'arbitration')!
    assert.include(
      arbitration.userMessage,
      'The house hall, for a spec.'
    )
    assert.include(arbitration.userMessage, 'a locked oak door')
    assert.include(arbitration.userMessage, '"reachable_locations"')
    assert.include(arbitration.userMessage, '"reference": "house_corridor"')
  })

  test('the walk is timed on its way, then what is done on arrival', async ({ assert }) => {
    const { userId, sessionId, worldState } = await arrangeHall()
    const { play } = buildService([
      going('house_corridor', { label: 'minutes' }),
      streamed('You climb the main staircase and search the corridor.'),
      extracted({ movement: 'house_corridor' }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I go up and search the corridor.' })

    /** Ten minutes up the stairs, ten more searching. */
    await worldState.refresh()
    assert.equal(worldState.gameTime, 16 * 3600 + 600 + 600)
    assert.equal(turn.gameTimeAfter, 16 * 3600 + 1200)
  })

  test('the narrator follows the way, passage by passage', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall([
      'house_yard',
      'house_hall',
      'house_kitchen',
      'house_cellar',
    ])
    const { provider, play } = buildService([
      going('house_cellar'),
      streamed('Through the kitchen and down the stairs.'),
      extracted({ movement: 'house_cellar' }),
    ])

    await play({ sessionId, userId, playerInput: 'I go down to the cellar.' })

    const narration = provider.requests.find(({ step }) => step === 'narration')!
    assert.include(narration.userMessage, '"through": "a swing door"')
    assert.include(narration.userMessage, '"through": "the cellar stairs"')
  })

  test('a destination the exits do not reach is asked for again', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const { play } = buildService([
      going('house_attic'),
      going('house_corridor'),
      streamed('You climb the main staircase.'),
      extracted({ movement: 'house_corridor' }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I go to the attic.' })

    assert.equal(turn.status, 'completed')
    assert.deepEqual(
      turn.rejectedAttempts!.map(({ step }) => step),
      ['arbitration']
    )
    assert.equal((await TurnLog.findOrFail(turn.id)).gameTimeAfter, 16 * 3600 + 600 + 60)
  })
})
