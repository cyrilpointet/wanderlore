import { test } from '@japa/runner'

import Character from '#models/character'
import TurnLog from '#models/turn_log'
import NpcInstance from '#models/npc_instance'
import LocationInstance from '#models/location_instance'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { visitUniqueLocation } from '#services/game/locations'
import { createItem } from '#services/game/inventory'
import { enterScene, meetThoseWaiting } from '#services/game/npcs'
import { passageStates } from '#services/game/passages'
import { toMessage } from '#services/game/turn_events'
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
 * D'Artagnan at four in the afternoon, standing in the last place of
 * `visited` — by default the hall, having come in by the yard: the rest of
 * the house is still to discover.
 */
async function arrangeHall(
  visited: string[] = ['house_yard', 'house_hall'],
  options: { holdsTheKey?: boolean } = {}
) {
  const content = await seedHouse()
  const userId = await createUser()
  const sessionId = await createSession(userId, content)

  const character = await Character.create({
    sessionId,
    name: "d'Artagnan",
    skills: { persuasion: 60 },
    characteristics: GASCON,
    resources: {},
    progression: {},
    hitPoints: 10,
    hitPointsMax: 10,
  })

  if (options.holdsTheKey) {
    await createItem(
      HOUSE_WORLD,
      sessionId,
      { definition: 'iron_key', descriptor: null, quantity: 1 },
      { type: 'character', id: character.id }
    )
  }

  let standing = null
  for (const reference of visited) {
    standing = await visitUniqueLocation(HOUSE_WORLD, sessionId, reference)
  }

  const worldState = await WorldState.create({
    sessionId,
    currentLocationId: standing!.id,
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
    assert.include(arbitration.userMessage, 'The house hall, for a spec.')
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
      'house_kitchen',
      'house_cellar',
      'house_hall',
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
    const logged = await TurnLog.findOrFail(turn.id)
    assert.equal(logged.gameTimeAfter, 16 * 3600 + 600 + 60)
  })
})

test.group('Networks | extraction and the ways it opens', (group) => {
  useTransaction(group)

  async function standingIn(sessionId: string): Promise<string> {
    const state = await WorldState.query()
      .where('sessionId', sessionId)
      .preload('currentLocation')
      .firstOrFail()

    return state.currentLocation.handle
  }

  test('a room two rooms away is no movement: asked again, then refused', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const tooFar = extracted({ movement: 'house_attic' })
    const { play } = buildService([
      going(null),
      streamed('You run up to the attic.'),
      tooFar,
      tooFar,
    ])

    await assert.rejects(() => play({ sessionId, userId, playerInput: 'I run to the attic.' }))

    const turn = await TurnLog.query().where('sessionId', sessionId).firstOrFail()
    assert.equal(turn.status, 'failed')
    assert.equal(await standingIn(sessionId), 'house_hall')
  })

  test('a hidden passage found and gone through in one turn', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall', 'house_study'])
    const { play } = buildService([
      going(null, { label: 'minutes' }),
      streamed('Behind the bookcase, a narrow stair: you go down into the cellar.'),
      extracted({ movement: 'house_cellar', passages_discovered: ['house_cellar'] }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I search the shelves.' })

    assert.equal(turn.status, 'completed')
    assert.equal(await standingIn(sessionId), 'house_cellar')
    const { discovered } = await passageStates(sessionId)
    assert.deepEqual([...discovered], ['house_study>house_cellar'])
    assert.deepEqual((turn.appliedEffects as any).passages.discovered, [
      { from: 'house_study', to: 'house_cellar' },
    ])
  })

  test('going through a hidden passage not found is refused', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall', 'house_study'])
    const through = extracted({ movement: 'house_cellar' })
    const { play } = buildService([
      going(null),
      streamed('You slip into the cellar.'),
      through,
      through,
    ])

    await assert.rejects(() => play({ sessionId, userId, playerInput: 'I go to the cellar.' }))

    assert.equal(await standingIn(sessionId), 'house_study')
  })

  test('a locked door gone through with its key is open for good', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall'], {
      holdsTheKey: true,
    })
    const { play } = buildService([
      going('house_study'),
      streamed('The iron key turns; you step into the study.'),
      extracted({ movement: 'house_study' }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I unlock the study.' })

    assert.equal(await standingIn(sessionId), 'house_study')
    const { unlocked } = await passageStates(sessionId)
    assert.deepEqual([...unlocked], ['house_hall>house_study'])
    assert.deepEqual((turn.appliedEffects as any).passages.unlocked, [
      { from: 'house_hall', to: 'house_study' },
    ])
  })

  test('a locked door forced open is open for good', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const { play } = buildService([
      going(null),
      streamed('The lock gives under your shoulder.'),
      extracted({ passages_unlocked: ['house_study'] }),
    ])

    await play({ sessionId, userId, playerInput: 'I force the study door.' })

    const { unlocked } = await passageStates(sessionId)
    assert.deepEqual([...unlocked], ['house_hall>house_study'])
    assert.equal(await standingIn(sessionId), 'house_hall')
  })

  test('the badge names the room within the house', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const { events, play } = buildService([
      going('house_kitchen'),
      streamed('You push through the swing door.'),
      extracted({ movement: 'house_kitchen' }),
    ])

    await play({ sessionId, userId, playerInput: 'I go to the kitchen.' })

    const completed = events.recorded.find(({ event }) => event.type === 'turn_completed')!
    const message = toMessage(completed.ref, completed.event) as Record<string, any>
    assert.deepEqual(message.location, {
      reference: 'house_kitchen',
      label: 'The kitchen · The house',
    })
  })
})

/** Whether someone is present, absent or dead, and in which place. */
async function placeOf(sessionId: string, handle: string) {
  const npc = await NpcInstance.query()
    .where('sessionId', sessionId)
    .where('handle', handle)
    .preload('location')
    .firstOrFail()

  return { status: npc.status, place: npc.location?.handle ?? null }
}

test.group('Networks | people where they were left', (group) => {
  useTransaction(group)

  /** Someone met in a room of the house, present or left there. */
  async function meet(
    sessionId: string,
    definition: string,
    room: string,
    rest: Partial<{ status: 'present' | 'absent' | 'dead'; disposition: 'hostile' }> = {}
  ) {
    const place = await LocationInstance.query()
      .where('sessionId', sessionId)
      .where('handle', room)
      .firstOrFail()
    const npc = await enterScene(
      HOUSE_WORLD,
      sessionId,
      { definition, descriptor: null },
      undefined,
      place.id
    )

    await npc.merge(rest).save()

    return npc.handle
  }

  test('left behind, followed, gone off', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const treville = await meet(sessionId, 'treville', 'house_hall')
    const guard = await meet(sessionId, 'cardinal_guard', 'house_hall')
    const athos = await meet(sessionId, 'athos', 'house_hall')
    const { play } = buildService([
      going('house_kitchen'),
      streamed('The guard follows you into the kitchen; Athos takes his leave.'),
      extracted({ movement: 'house_kitchen', npcs_following: [guard], npcs_left: [athos] }),
    ])

    await play({ sessionId, userId, playerInput: 'I go to the kitchen.' })

    assert.deepEqual(await placeOf(sessionId, treville), { status: 'absent', place: 'house_hall' })
    assert.deepEqual(await placeOf(sessionId, guard), { status: 'present', place: 'house_kitchen' })
    /** Gone off on his own: nobody knows where. */
    assert.deepEqual(await placeOf(sessionId, athos), { status: 'absent', place: null })
  })

  test('found again where they were left, and met by the narration', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall', 'house_kitchen'])
    const treville = await meet(sessionId, 'treville', 'house_hall', { status: 'absent' })
    const { provider, play } = buildService([
      going('house_hall'),
      streamed('Tréville is still in the hall.'),
      extracted({ movement: 'house_hall' }),
    ])

    await play({ sessionId, userId, playerInput: 'I go back to the hall.' })

    assert.deepEqual(await placeOf(sessionId, treville), { status: 'present', place: 'house_hall' })
    const narration = provider.requests.find(({ step }) => step === 'narration')!
    assert.include(
      narration.userMessage,
      '"npcs_at_destination": [\n    {\n      "handle": "treville"'
    )
  })

  test('the dead stay dead', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall', 'house_kitchen'])
    const jussac = await meet(sessionId, 'jussac', 'house_hall', { status: 'dead' })
    const { play } = buildService([
      going('house_hall'),
      streamed('Jussac lies where he fell.'),
      extracted({ movement: 'house_hall' }),
    ])

    await play({ sessionId, userId, playerInput: 'I go back to the hall.' })

    assert.deepEqual(await placeOf(sessionId, jussac), { status: 'dead', place: 'house_hall' })
  })

  test('someone hostile bars the way through their room, not into it', async ({ assert }) => {
    const every = ['house_yard', 'house_corridor', 'house_cellar', 'house_hall', 'house_kitchen']
    const { userId, sessionId } = await arrangeHall(every)
    await meet(sessionId, 'cardinal_guard', 'house_hall', {
      status: 'absent',
      disposition: 'hostile',
    })
    const { provider, play } = buildService([
      going('house_hall'),
      streamed('The guard is waiting for you.'),
      extracted({ movement: 'house_hall' }),
    ])

    await play({ sessionId, userId, playerInput: 'I go to the hall.' })

    const arbitration = provider.requests.find(({ step }) => step === 'arbitration')!
    assert.include(arbitration.userMessage, '"reference": "house_hall"')
    /** Up the stairs from the kitchen is through the hall: no longer a way. */
    assert.notInclude(arbitration.userMessage, '"reference": "house_corridor"')
  })
})

test.group('Networks | people waiting from the start', (group) => {
  useTransaction(group)

  const STEWARD = 'house_steward'

  async function count(sessionId: string, handle: string) {
    const instances = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', handle)
    return instances.length
  }

  test('the first visit brings them in, waiting there until the character arrives', async ({
    assert,
  }) => {
    const { sessionId } = await arrangeHall()
    assert.equal(await count(sessionId, STEWARD), 0)

    const attic = await visitUniqueLocation(HOUSE_WORLD, sessionId, 'house_attic')
    assert.deepEqual(await placeOf(sessionId, STEWARD), { status: 'absent', place: 'house_attic' })

    await visitUniqueLocation(HOUSE_WORLD, sessionId, 'house_attic')
    assert.equal(await count(sessionId, STEWARD), 1)

    await meetThoseWaiting(sessionId, attic.id)
    assert.deepEqual(await placeOf(sessionId, STEWARD), { status: 'present', place: 'house_attic' })
  })

  test('met on arriving in their room, and announced to the narration', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall', 'house_corridor'])
    const { provider, play } = buildService([
      going('house_attic'),
      streamed('The steward is crouching among the trunks.'),
      extracted({ movement: 'house_attic' }),
    ])

    await play({ sessionId, userId, playerInput: 'I climb the ladder to the attic.' })

    assert.deepEqual(await placeOf(sessionId, STEWARD), { status: 'present', place: 'house_attic' })
    const narration = provider.requests.find(({ step }) => step === 'narration')!
    assert.include(
      narration.userMessage,
      '"npcs_at_destination": [\n    {\n      "handle": "house_steward"'
    )
  })

  test('within reach of their room, extraction may bring them in', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall(['house_yard', 'house_hall', 'house_corridor'])
    const { provider, play } = buildService([
      going(null),
      streamed('The steward comes down the ladder, blinking.'),
      extracted({ npcs_entered: [{ definition: STEWARD, descriptor: null }] }),
    ])

    await play({ sessionId, userId, playerInput: 'I call up the ladder.' })

    const extraction = provider.requests.find(({ step }) => step === 'extraction')!
    assert.include(extraction.userMessage, `"definition": "${STEWARD}"`)
    assert.deepEqual(await placeOf(sessionId, STEWARD), {
      status: 'present',
      place: 'house_corridor',
    })
  })

  test('far from their room, nobody brings them in before they are met', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHall()
    const elsewhere = extracted({ npcs_entered: [{ definition: STEWARD, descriptor: null }] })
    const { provider, play } = buildService([
      going(null),
      streamed('A man comes in.'),
      elsewhere,
      elsewhere,
    ])

    await assert.rejects(() => play({ sessionId, userId, playerInput: 'I wait in the hall.' }))

    const extraction = provider.requests.find(({ step }) => step === 'extraction')!
    assert.notInclude(extraction.userMessage, `"definition": "${STEWARD}"`)
    assert.equal(await count(sessionId, STEWARD), 0)
  })

  test('met elsewhere first, they are not brought in again on the visit', async ({ assert }) => {
    const { sessionId } = await arrangeHall()
    const hall = await LocationInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_hall')
      .firstOrFail()
    await enterScene(
      HOUSE_WORLD,
      sessionId,
      { definition: STEWARD, descriptor: null },
      undefined,
      hall.id
    )

    await visitUniqueLocation(HOUSE_WORLD, sessionId, 'house_attic')

    assert.equal(await count(sessionId, STEWARD), 1)
    assert.deepEqual(await placeOf(sessionId, STEWARD), { status: 'present', place: 'house_hall' })
  })
})
