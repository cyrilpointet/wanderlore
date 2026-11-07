import { test } from '@japa/runner'
import { playAs } from '#tests/helpers/characters'

import CharacterState from '#models/character_state'
import EventState from '#models/event_state'
import InventoryItem from '#models/inventory_item'
import NpcDefinition from '#models/npc_definition'
import NpcInstance from '#models/npc_instance'
import PlaceNote from '#models/place_note'
import Scenario from '#models/scenario'
import Session from '#models/session'
import WorldState from '#models/world_state'
import { DiceService } from '#services/dice'
import { LlmGateway } from '#services/llm/gateway'
import { RulesEngine } from '#services/rules/engine'
import { TurnService } from '#services/game/turn_service'
import { visitUniqueLocation } from '#services/game/locations'
import { pendingOf } from '#services/game/pending_effects'
import { passageStates } from '#services/game/passages'
import type { ScenarioEvent, ScenarioFlag, ScheduleEntry } from '#services/game/content/types'
import { MemoryQueue } from '#services/queue/drivers/memory_queue'
import { HOUSE_WORLD } from '#tests/helpers/places'
import { GASCON } from '#tests/helpers/worlds'
import { seedHouse } from '#tests/helpers/content'
import { FakeLlmProvider, streamed } from '#tests/helpers/fake_llm_provider'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { FakeClock } from '#tests/helpers/fake_clock'
import { RecordingTurnEvents } from '#tests/helpers/recording_turn_events'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'
import { CHARACTER, extracted, playerOf } from '#tests/helpers/turns'

/**
 * Deadlines and events (roadmap, Phase 11), played in the house of the specs:
 * the world moving on with the clock, the state setting events off, people
 * keeping their schedules — the model replaced.
 */

const HOUR = 3600

/** A ruling that settles the action at once, for as long as `duration` says. */
function ruling(duration: Record<string, unknown>, intent: Record<string, unknown> = {}) {
  return {
    intent: {
      type: 'rest',
      target: null,
      summary: 'Waiting',
      destination: null,
      ...intent,
    },
    validity: { factual: true, plausibility: 'plausible', justification: 'Nothing prevents it.' },
    resolution: { mode: 'automatic_success', action_type: null, difficulty: null },
    duration: { label: 'moment', count: null, period: null, event: null, npc: null, ...duration },
    alert: { prompt_injection_suspected: false, out_of_scope: false },
  }
}

function buildService(answers: unknown[], faces: number[] = [30]) {
  const provider = new FakeLlmProvider({ jsonSequence: answers })
  const events = new RecordingTurnEvents()
  const service = new TurnService(
    new LlmGateway(provider, { requestTimeoutMs: 1000 }),
    new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces))),
    new MemoryQueue(),
    events,
    new FakeClock()
  )

  return {
    provider,
    events,
    play: playerOf(service),
    messageOf: (step: string) => provider.requests.find((request) => request.step === step)!,
  }
}

function event(reference: string, rest: Partial<ScenarioEvent>): ScenarioEvent {
  return {
    reference,
    when: { at: null, conditions: [], delay: null },
    unless: [],
    place: null,
    description: `${reference}, for a spec.`,
    effects: [],
    interrupts: false,
    foreseeable: null,
    ...rest,
  }
}

const FLAGS: ScenarioFlag[] = [
  { reference: 'alarm_raised', description: 'Someone in the house has raised the alarm.' },
  { reference: 'raid_over', description: 'The raiders have gone.' },
]

/**
 * D'Artagnan in the house of the specs, at `gameTime` on the first day,
 * standing in the last place of `visited` — the scenario holding `events`,
 * and the steward keeping `schedule`.
 */
async function arrangeHouse(
  options: {
    events?: ScenarioEvent[]
    schedule?: ScheduleEntry[]
    visited?: string[]
    gameTime?: number
    knownNpcs?: string[]
  } = {}
) {
  const content = await seedHouse()
  const scenario = await Scenario.findOrFail(content.scenarioId)
  scenario.merge({ flags: FLAGS, events: options.events ?? [] })
  await scenario.save()

  if (options.schedule) {
    const steward = await NpcDefinition.query()
      .where('reference', 'house_steward')
      .where('scenarioId', content.scenarioId)
      .firstOrFail()
    steward.schedule = options.schedule
    await steward.save()
  }

  const userId = await createUser()
  const sessionId = await createSession(userId, content)
  const { character } = await playAs(sessionId, {
    name: "d'Artagnan",
    skills: {},
    characteristics: GASCON,
    resources: {},
    hitPoints: 26,
    hitPointsMax: 26,
  })

  let standing = null
  for (const reference of options.visited ?? ['house_yard', 'house_hall']) {
    standing = await visitUniqueLocation(HOUSE_WORLD, sessionId, reference)
  }

  const worldState = await WorldState.create({
    sessionId,
    currentLocationId: standing!.id,
    activeQuests: [],
    narrativeFlags: {},
    knownNpcs: options.knownNpcs ?? [],
    gameTime: options.gameTime ?? 21 * HOUR,
  })

  return { userId, sessionId, worldState, character, here: standing! }
}

function progressOf(sessionId: string, reference: string) {
  return EventState.query()
    .where('sessionId', sessionId)
    .where('eventReference', reference)
    .firstOrFail()
}

/** Masked men burst into the hall at eleven at night, the first night. */
const NIGHT_RAID = event('night_raid', {
  when: { at: { day: 1, period: null, time: '23:00' }, conditions: [], delay: null },
  place: 'house_hall',
  description: 'Masked men burst into the hall, swords drawn.',
  effects: [
    { type: 'npc_entered', npc: 'cardinal_guard', location: 'house_hall', descriptor: null },
    { type: 'flag_set', flag: 'alarm_raised' },
  ],
  interrupts: true,
})

test.group('Deadlines | the clock sets events off', (group) => {
  useTransaction(group)

  test('asleep until dawn, the character is woken by a raid in the night', async ({ assert }) => {
    const { userId, sessionId, worldState, here } = await arrangeHouse({ events: [NIGHT_RAID] })
    const { play, messageOf } = buildService([
      ruling({ label: 'until', period: 'dawn' }),
      streamed('You fall asleep, and wake to the clash of steel.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I sleep until dawn.' })

    /** Cut short at eleven, not dawn. */
    await worldState.refresh()
    assert.equal(worldState.gameTime, 23 * HOUR)
    assert.deepEqual(turn.eventsFired?.interrupted, { event: 'night_raid', at: 23 * HOUR })

    const raider = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'cardinal_guard_1')
      .firstOrFail()
    assert.equal(raider.status, 'present')
    assert.equal(raider.locationInstanceId, here.id)
    assert.propertyVal(worldState.narrativeFlags, 'alarm_raised', true)

    const narration = messageOf('narration').userMessage
    assert.include(narration, '"interrupted":"Masked men burst into the hall, swords drawn."')
    assert.include(narration, '"when":"now"')
    assert.include(narration, '"handle":"cardinal_guard_1"')
    /** Extraction reads the raider as someone present already: never brought in twice. */
    assert.include(messageOf('extraction').userMessage, '"handle":"cardinal_guard_1"')

    const progress = await progressOf(sessionId, 'night_raid')
    assert.equal(progress.firedAt, 23 * HOUR)
    assert.isTrue(progress.witnessed)
    assert.isTrue(progress.told)
  })

  test('an event falls once only', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({ events: [NIGHT_RAID] })
    const { play } = buildService([
      ruling({ label: 'until', period: 'dawn' }),
      streamed('You wake to steel.'),
      extracted(),
      ruling({ label: 'until', period: 'dawn' }),
      streamed('You sleep again.'),
      extracted(),
    ])

    await play({ sessionId, userId, playerInput: 'I sleep until dawn.' })
    const second = await play({ sessionId, userId, playerInput: 'I sleep until dawn.' })

    assert.deepEqual(second.eventsFired?.timed, [])
    assert.isNull(second.eventsFired?.interrupted)
    const raiders = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('definitionReference', 'cardinal_guard')
    assert.lengthOf(raiders, 1)
  })

  test('an event elsewhere happens unseen, and arbitration learns of it', async ({ assert }) => {
    const fire = event('kitchen_fire', {
      when: { at: { day: 1, period: null, time: '22:00' }, conditions: [], delay: null },
      place: 'house_kitchen',
      description: 'A fire breaks out in the kitchen and blocks its door.',
      effects: [
        { type: 'passage_blocked', from: 'house_hall', to: 'house_kitchen' },
        { type: 'place_note_set', location: 'house_kitchen', note: 'Soot blackens every wall.' },
      ],
      interrupts: true,
    })
    const { userId, sessionId, worldState } = await arrangeHouse({ events: [fire] })
    const { play, provider } = buildService([
      ruling({ label: 'hours' }),
      streamed('You read for hours by the fire.'),
      extracted(),
      ruling({ label: 'moment' }),
      streamed('You look around.'),
      extracted(),
    ])

    const first = await play({ sessionId, userId, playerInput: 'I read.' })

    /** Not seen: it neither wakes the character nor reaches the narration. */
    await worldState.refresh()
    assert.equal(worldState.gameTime, 25 * HOUR)
    assert.isNull(first.eventsFired?.interrupted)
    assert.notInclude(provider.requests[1].userMessage, 'A fire breaks out')

    const passages = await passageStates(sessionId)
    assert.isTrue(passages.blocked!.has('house_hall>house_kitchen'))
    const note = await PlaceNote.query().where('sessionId', sessionId).firstOrFail()
    assert.equal(note.locationReference, 'house_kitchen')

    await play({ sessionId, userId, playerInput: 'I look around.' })

    const arbitration = provider.requests[3].userMessage
    assert.include(arbitration, '"world_events":["A fire breaks out in the kitchen')
    assert.include(arbitration, '"blocked":true')
  })

  test('an unless that holds cancels a deadline', async ({ assert }) => {
    const spared = { ...NIGHT_RAID, unless: [{ type: 'flag' as const, flag: 'raid_over' }] }
    const { userId, sessionId, worldState } = await arrangeHouse({ events: [spared] })
    worldState.narrativeFlags = { raid_over: true }
    await worldState.save()
    const { play } = buildService([
      ruling({ label: 'until', period: 'dawn' }),
      streamed('You sleep through the night.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I sleep until dawn.' })

    assert.deepEqual(
      turn.eventsFired?.timed.map(({ outcome }) => outcome),
      ['cancelled']
    )
    assert.isNull(turn.eventsFired?.interrupted)
    const progress = await progressOf(sessionId, 'night_raid')
    assert.isNull(progress.firedAt)
    assert.equal(progress.cancelledAt, 23 * HOUR)
  })

  test('an aside sets nothing off', async ({ assert }) => {
    const overdue = {
      ...NIGHT_RAID,
      when: { ...NIGHT_RAID.when, at: { day: 1, period: null, time: '20:00' } },
    }
    const { userId, sessionId } = await arrangeHouse({ events: [overdue] })
    const { play } = buildService([
      ruling({ label: 'moment' }, { type: 'out_of_character' }),
      streamed('You are in the hall.'),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'Where am I?' })

    assert.deepEqual(turn.eventsFired?.timed, [])
    assert.lengthOf(await EventState.query().where('sessionId', sessionId), 0)
  })
})

test.group('Deadlines | the state sets events off', (group) => {
  useTransaction(group)

  /** The steward comes down to the hall the moment the character holds the key. */
  const KEY_TAKEN = event('key_taken', {
    when: {
      at: null,
      conditions: [{ type: 'item_held_by', item: 'iron_key', holder: { holder: 'character' } }],
      delay: null,
    },
    place: 'house_hall',
    description: 'The steward comes running down the stairs, shouting for his key.',
    effects: [
      { type: 'npc_moved', npc: 'house_steward', location: 'house_hall' },
      { type: 'npc_disposition', npc: 'house_steward', disposition: 'hostile' },
    ],
  })

  test('taking the key sets the event off, and the next narration tells it', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({ events: [KEY_TAKEN] })
    const { play, provider } = buildService([
      ruling({ label: 'minutes' }, { type: 'search' }),
      streamed('Under a loose flagstone, you find an iron key.'),
      extracted({
        items_created: [
          {
            definition: 'iron_key',
            descriptor: null,
            quantity: 1,
            holder: CHARACTER,
            equipped: false,
          },
        ],
      }),
      ruling({ label: 'moment' }),
      streamed('The steward bars your way.'),
      extracted(),
    ])

    const first = await play({ sessionId, userId, playerInput: 'I search the hall.' })

    assert.deepEqual(first.eventsFired?.state, [
      { event: 'key_taken', outcome: 'fired', witnessed: true },
    ])
    const steward = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .firstOrFail()
    assert.equal(steward.status, 'present')
    assert.equal(steward.disposition, 'hostile')
    /** Told on the turn after, not in the narration that set it off. */
    assert.notInclude(provider.requests[1].userMessage, 'shouting for his key')

    const second = await play({ sessionId, userId, playerInput: 'I stand my ground.' })

    assert.include(provider.requests[4].userMessage, 'shouting for his key')
    assert.include(provider.requests[4].userMessage, '"when":"earlier"')
    assert.deepEqual(second.eventsFired?.told, ['key_taken'])
    const progress = await progressOf(sessionId, 'key_taken')
    assert.isTrue(progress.told)
  })

  test('an event with a delay is armed, then falls when it is over', async ({ assert }) => {
    const later = {
      ...KEY_TAKEN,
      when: { ...KEY_TAKEN.when, delay: { label: 'hour' as const } },
      interrupts: true,
    }
    const { userId, sessionId, worldState } = await arrangeHouse({ events: [later] })
    const { play } = buildService([
      ruling({ label: 'moment' }, { type: 'take' }),
      streamed('You pocket the key.'),
      extracted({
        items_created: [
          {
            definition: 'iron_key',
            descriptor: null,
            quantity: 1,
            holder: CHARACTER,
            equipped: false,
          },
        ],
      }),
      ruling({ label: 'hours' }),
      streamed('You wait, and the steward comes.'),
      extracted(),
    ])

    const first = await play({ sessionId, userId, playerInput: 'I take the key.' })
    assert.deepEqual(first.eventsFired?.state, [
      { event: 'key_taken', outcome: 'armed', witnessed: false },
    ])
    const armed = await progressOf(sessionId, 'key_taken')
    assert.equal(armed.armedAt, 21 * HOUR + 60)

    const second = await play({ sessionId, userId, playerInput: 'I wait.' })

    /** An hour after the key was taken, it cuts the wait short. */
    await worldState.refresh()
    assert.equal(worldState.gameTime, 22 * HOUR + 60)
    assert.deepEqual(second.eventsFired?.interrupted, { event: 'key_taken', at: 22 * HOUR + 60 })
  })

  test('a chain: the steward in the kitchen leaves a rope in a room never visited', async ({
    assert,
  }) => {
    const alarm = event('alarm', {
      when: { at: null, conditions: [{ type: 'flag', flag: 'alarm_raised' }], delay: null },
      effects: [{ type: 'npc_moved', npc: 'house_steward', location: 'house_kitchen' }],
    })
    const rope = event('rope_left', {
      when: {
        at: null,
        conditions: [{ type: 'npc_at', npc: 'house_steward', location: 'house_kitchen' }],
        delay: null,
      },
      effects: [
        {
          type: 'item_placed',
          item: 'rope',
          holder: { holder: 'location', reference: 'house_bedroom' },
          quantity: 1,
        },
      ],
    })
    const { userId, sessionId } = await arrangeHouse({
      events: [alarm, rope],
      visited: ['house_yard', 'house_kitchen', 'house_hall'],
    })
    const { play } = buildService([
      ruling({ label: 'moment' }, { type: 'shout' }),
      streamed('You shout for help.'),
      extracted({ scenario_flags: ['alarm_raised'] }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I raise the alarm.' })

    assert.deepEqual(
      turn.eventsFired?.state.map(({ event: settled }) => settled),
      ['alarm', 'rope_left']
    )
    /** The bedroom has never been visited: the rope waits for it. */
    const pending = await pendingOf(sessionId)
    assert.deepEqual(
      pending.map(({ waitsFor, event: from }) => [waitsFor, from]),
      [[{ location: 'house_bedroom' }, 'rope_left']]
    )

    const bedroom = await visitUniqueLocation(HOUSE_WORLD, sessionId, 'house_bedroom')
    const ropes = await InventoryItem.query()
      .where('sessionId', sessionId)
      .where('definitionReference', 'rope')
    assert.lengthOf(ropes, 1)
    assert.equal(ropes[0].locationInstanceId, bedroom.id)
    assert.deepEqual(await pendingOf(sessionId), [])
  })
})

/** The steward: in the attic by day, in the kitchen from dusk, keeping to it even before the character. */
const STEWARD_DAY: ScheduleEntry[] = [
  {
    periods: ['dawn', 'morning', 'midday', 'afternoon'],
    location: 'house_attic',
    activity: 'counts the silver',
    leavesScene: true,
    interrupts: false,
  },
  {
    periods: ['dusk', 'evening', 'night'],
    location: 'house_kitchen',
    activity: 'warms himself by the stove',
    leavesScene: false,
    interrupts: true,
  },
]

test.group('Deadlines | schedules', (group) => {
  useTransaction(group)

  test('someone not met yet is found where their schedule has them', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({ schedule: STEWARD_DAY })
    const { play, messageOf } = buildService([
      ruling({ label: 'moment' }, { type: 'movement', destination: 'house_kitchen' }),
      streamed('You push the swing door.'),
      extracted({ movement: 'house_kitchen' }),
    ])

    await play({ sessionId, userId, playerInput: 'I go into the kitchen.' })

    /** At nine in the evening, by the stove — not in the attic he waits in from the start. */
    assert.include(
      messageOf('narration').userMessage,
      '"npcs_at_destination":[{"handle":"house_steward"'
    )
    const steward = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .preload('location')
      .firstOrFail()
    assert.equal(steward.status, 'present')
    assert.equal(steward.location.handle, 'house_kitchen')
  })

  test('their arrival where the character waits cuts the wait short', async ({ assert }) => {
    const { userId, sessionId, worldState } = await arrangeHouse({
      schedule: STEWARD_DAY,
      visited: ['house_yard', 'house_hall', 'house_kitchen'],
      gameTime: 15 * HOUR,
    })
    const { play, messageOf } = buildService([
      ruling({ label: 'hours' }),
      streamed('The steward comes in and finds you there.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I hide and wait.' })

    await worldState.refresh()
    assert.equal(worldState.gameTime, 18 * HOUR)
    assert.deepEqual(turn.eventsFired?.interrupted, { npc: 'house_steward', at: 18 * HOUR })
    assert.include(messageOf('narration').userMessage, '"activity":"warms himself by the stove"')
    const steward = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .firstOrFail()
    assert.equal(steward.status, 'present')
  })

  test('away from the scene, they keep to their schedule', async ({ assert }) => {
    const { userId, sessionId, here } = await arrangeHouse({
      schedule: STEWARD_DAY,
      visited: ['house_yard', 'house_kitchen', 'house_corridor', 'house_attic', 'house_hall'],
      gameTime: 10 * HOUR,
    })
    /** Met on the visit to the attic, where he waits from the start, and left there. */
    const { play } = buildService([
      ruling({ label: 'until', period: 'dusk' }),
      streamed('You wait in the hall until dusk.'),
      extracted(),
    ])

    await play({ sessionId, userId, playerInput: 'I wait until dusk.' })

    const steward = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .preload('location')
      .firstOrFail()
    assert.equal(steward.status, 'absent')
    assert.equal(steward.location.handle, 'house_kitchen')
    assert.notEqual(steward.locationInstanceId, here.id)
  })

  test('in the scene, they leave only when their schedule says so', async ({ assert }) => {
    const { userId, sessionId, here } = await arrangeHouse({
      schedule: STEWARD_DAY,
      visited: ['house_yard', 'house_kitchen', 'house_corridor', 'house_attic', 'house_hall'],
      gameTime: 4 * HOUR,
    })
    /** Met in the attic, he came down with the character. */
    await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .update({ status: 'present', locationInstanceId: here.id })
    const { play, messageOf } = buildService([
      ruling({ label: 'hours' }),
      streamed('At dawn the steward hurries off upstairs.'),
      extracted(),
    ])

    await play({ sessionId, userId, playerInput: 'I talk with the steward.' })

    /** At dawn his day begins in the attic, company or not. */
    assert.include(messageOf('narration').userMessage, '"npcs_leaving":["house_steward"]')
    const steward = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .preload('location')
      .firstOrFail()
    assert.equal(steward.status, 'absent')
    assert.equal(steward.location.handle, 'house_attic')
  })
})

test.group('Deadlines | waiting for something', (group) => {
  useTransaction(group)

  /** At eleven, a visitor knocks at the front door: the character was told to expect him. */
  const VISITOR = event('visitor', {
    when: { at: { day: 1, period: null, time: '23:00' }, conditions: [], delay: null },
    place: 'house_hall',
    description: 'The steward shows a cloaked visitor into the hall.',
    effects: [{ type: 'npc_moved', npc: 'house_steward', location: 'house_hall' }],
    foreseeable: [],
  })

  test('waiting for an event the character knows of ends as it comes', async ({ assert }) => {
    const { userId, sessionId, worldState } = await arrangeHouse({ events: [VISITOR] })
    const { play, messageOf } = buildService([
      ruling({ label: 'until_event', event: 'visitor' }),
      streamed('At last, the visitor comes.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I wait for the visitor.' })

    assert.include(
      messageOf('arbitration').userMessage,
      '"foreseeable_events":[{"reference":"visitor"'
    )
    await worldState.refresh()
    assert.equal(worldState.gameTime, 23 * HOUR)
    assert.deepEqual(turn.eventsFired?.awaited, { event: 'visitor', arrived: true })
    assert.include(messageOf('narration').userMessage, '"awaited":"arrived"')
    const steward = await NpcInstance.query()
      .where('sessionId', sessionId)
      .where('handle', 'house_steward')
      .firstOrFail()
    assert.equal(steward.status, 'present')
  })

  test('waiting for someone whose schedule brings them', async ({ assert }) => {
    const { userId, sessionId, worldState } = await arrangeHouse({
      schedule: STEWARD_DAY,
      visited: ['house_yard', 'house_hall', 'house_kitchen'],
      gameTime: 12 * HOUR,
      knownNpcs: ['house_steward'],
    })
    const { play, messageOf } = buildService([
      ruling({ label: 'until_npc', npc: 'house_steward' }),
      streamed('He comes down at dusk.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I wait for the steward.' })

    assert.include(
      messageOf('arbitration').userMessage,
      '"awaitable_npcs":[{"reference":"house_steward"'
    )
    await worldState.refresh()
    assert.equal(worldState.gameTime, 18 * HOUR)
    assert.deepEqual(turn.eventsFired?.awaited, { npc: 'house_steward', arrived: true })
  })

  test('waiting in vain: an afternoon goes by, and nothing comes', async ({ assert }) => {
    const cancelled = { ...VISITOR, unless: [{ type: 'flag' as const, flag: 'raid_over' }] }
    const { userId, sessionId, worldState } = await arrangeHouse({ events: [cancelled] })
    worldState.narrativeFlags = { raid_over: true }
    await worldState.save()
    const { play, messageOf } = buildService([
      ruling({ label: 'until_event', event: 'visitor' }),
      streamed('Nobody comes.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I wait for the visitor.' })

    await worldState.refresh()
    assert.equal(worldState.gameTime, 25 * HOUR)
    assert.deepEqual(turn.eventsFired?.awaited, { event: 'visitor', arrived: false })
    assert.include(messageOf('narration').userMessage, '"awaited":"did_not_happen"')
  })

  test('only what the character knows is coming may be waited for', async ({ assert }) => {
    const secret = { ...VISITOR, foreseeable: null }
    const { userId, sessionId } = await arrangeHouse({ events: [secret] })
    const { play } = buildService([
      ruling({ label: 'until_event', event: 'visitor' }),
      ruling({ label: 'until_event', event: 'visitor' }),
    ])

    await assert.rejects(() => play({ sessionId, userId, playerInput: 'I wait for the visitor.' }))
  })
})

test.group('Deadlines | an event hurts the character', (group) => {
  useTransaction(group)

  /** A lever pulled in the hall sets off an explosion there. */
  const EXPLOSION = event('hall_explosion', {
    when: { at: null, conditions: [{ type: 'flag', flag: 'alarm_raised' }], delay: null },
    place: 'house_hall',
    description: 'The lever sets off an explosion that tears through the hall.',
    effects: [{ type: 'character_harmed', damage: '3D6' }],
  })

  const pullTheLever = () => [
    ruling({ label: 'moment' }, { type: 'manipulate' }),
    streamed('You pull the lever.'),
    extracted({ scenario_flags: ['alarm_raised'] }),
  ]

  async function wearBuffCoat(sessionId: string, characterId: string) {
    await InventoryItem.create({
      sessionId,
      characterId,
      definitionReference: 'buff_coat',
      handle: 'buff_coat_1',
      quantity: 1,
      state: 'equipped',
    })
  }

  function stateOf(sessionId: string) {
    return CharacterState.query().where('sessionId', sessionId).firstOrFail()
  }

  test('a trap where the character stands hurts them, through their armour', async ({ assert }) => {
    const { userId, sessionId, character } = await arrangeHouse({ events: [EXPLOSION] })
    await wearBuffCoat(sessionId, character.id)
    const { play } = buildService(pullTheLever(), [6, 6, 6])

    const turn = await play({ sessionId, userId, playerInput: 'I pull the lever.' })

    assert.deepEqual(turn.eventsFired?.state, [
      {
        event: 'hall_explosion',
        outcome: 'fired',
        witnessed: true,
        harm: [{ damage: '3D6', rolled: 18, armor: 1, total: 17 }],
      },
    ])
    const state = await stateOf(sessionId)
    assert.equal(state.hitPoints, 9)
    assert.isTrue(state.firstAidAvailable)
    assert.isNotNull(state.healingSince)
    /** The player is shown every hit point the turn moved, the trap's included. */
    assert.equal(turn.appliedEffects?.hit_points_delta, -17)
  })

  test('elsewhere, the trap hurts no one, and no die is rolled', async ({ assert }) => {
    const elsewhere = { ...EXPLOSION, place: 'house_kitchen' }
    const { userId, sessionId } = await arrangeHouse({ events: [elsewhere] })
    const { play } = buildService(pullTheLever(), [])

    const turn = await play({ sessionId, userId, playerInput: 'I pull the lever.' })

    assert.deepEqual(turn.eventsFired?.state, [
      { event: 'hall_explosion', outcome: 'fired', witnessed: false },
    ])
    const state = await stateOf(sessionId)
    assert.equal(state.hitPoints, 26)
  })

  test('a harm felt everywhere at a set hour, fixed as written', async ({ assert }) => {
    const plague = event('plague_strikes', {
      when: { at: { day: 1, period: null, time: '22:00' }, conditions: [], delay: null },
      description: 'A fever comes over the whole house.',
      effects: [{ type: 'character_harmed', damage: '6' }],
    })
    const { userId, sessionId } = await arrangeHouse({ events: [plague] })
    const { play } = buildService(
      [ruling({ label: 'hours', count: 2 }), streamed('The hours drag on.'), extracted()],
      []
    )

    const turn = await play({ sessionId, userId, playerInput: 'I wait.' })

    assert.deepEqual(turn.eventsFired?.timed, [
      {
        event: 'plague_strikes',
        at: 22 * HOUR,
        outcome: 'fired',
        witnessed: true,
        harm: [{ damage: '6', rolled: 6, armor: 0, total: 6 }],
      },
    ])
    const state = await stateOf(sessionId)
    assert.equal(state.hitPoints, 20)
  })
})

test.group('Deadlines | the end of a game', (group) => {
  useTransaction(group)

  const wins = (
    reference: string,
    when: Partial<ScenarioEvent['when']>,
    rest: Partial<ScenarioEvent> = {}
  ) =>
    event(reference, {
      when: { at: null, conditions: [], delay: null, ...when },
      effects: [{ type: 'game_ended', outcome: 'completed' }],
      ...rest,
    })
  const loses = (
    reference: string,
    when: Partial<ScenarioEvent['when']>,
    rest: Partial<ScenarioEvent> = {}
  ) =>
    event(reference, {
      when: { at: null, conditions: [], delay: null, ...when },
      effects: [{ type: 'game_ended', outcome: 'failed' }],
      ...rest,
    })
  const RAISED = { type: 'flag' as const, flag: 'alarm_raised' }

  function gameOf(sessionId: string) {
    return Session.findOrFail(sessionId)
  }

  test('an event of the state wins the game, and no turn is played after', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({
      events: [wins('saved', { conditions: [RAISED] })],
    })
    const { play } = buildService([
      ruling({ label: 'moment' }),
      streamed('You ring the bell.'),
      extracted({ scenario_flags: ['alarm_raised'] }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I ring the bell.' })

    const game = await gameOf(sessionId)
    assert.deepEqual([game.status, game.endReason], ['completed', 'victory'])
    assert.deepEqual(turn.gameEnd, { reason: 'victory', event: 'saved', discarded: [] })
    await assert.rejects(() => play({ sessionId, userId, playerInput: 'I wait.' }))
  })

  test('a deadline loses the game, and the narration never tells it', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({
      events: [
        loses(
          'eaten',
          { at: { day: 1, period: null, time: '22:00' } },
          {
            description: 'The ogre eats the princess.',
          }
        ),
        /** After the end, nothing falls. */
        event('dawn_bells', {
          when: { at: { day: 1, period: null, time: '22:30' }, conditions: [], delay: null },
          effects: [{ type: 'flag_set', flag: 'raid_over' }],
        }),
      ],
    })
    const { play, messageOf } = buildService([
      ruling({ label: 'hours', count: 2 }),
      streamed('The hours drag on.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I wait.' })

    const game = await gameOf(sessionId)
    assert.deepEqual([game.status, game.endReason], ['failed', 'defeat'])
    assert.deepEqual(
      turn.eventsFired?.timed.map(({ event: reference }) => reference),
      ['eaten']
    )
    assert.notInclude(messageOf('narration').userMessage, 'The ogre eats the princess')
  })

  test('a wound read outside a fight kills the character', async ({ assert }) => {
    const { userId, sessionId, character } = await arrangeHouse()
    await CharacterState.query().where('characterId', character.id).update({ hitPoints: 3 })
    const { play } = buildService([
      ruling({ label: 'moment' }),
      streamed('You fall down the stairs.'),
      extracted({ hit_points_delta: -5 }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I run down the stairs.' })

    const game = await gameOf(sessionId)
    assert.deepEqual([game.status, game.endReason], ['failed', 'death'])
    assert.deepEqual(turn.gameEnd, { reason: 'death', event: null, discarded: [] })
  })

  test('death before a victory the clock brought the same turn', async ({ assert }) => {
    const { userId, sessionId, character } = await arrangeHouse({
      events: [wins('dawn_reached', { at: { day: 1, period: null, time: '22:00' } })],
    })
    await CharacterState.query().where('characterId', character.id).update({ hitPoints: 3 })
    const { play } = buildService([
      ruling({ label: 'hours', count: 2 }),
      streamed('You bleed out as the hours pass.'),
      extracted({ hit_points_delta: -5 }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I wait.' })

    const game = await gameOf(sessionId)
    assert.equal(game.endReason, 'death')
    assert.deepEqual(turn.gameEnd, {
      reason: 'death',
      event: null,
      discarded: [{ reason: 'victory', event: 'dawn_reached' }],
    })
  })

  test('an end stops the chain of events with it', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({
      events: [
        loses('caught', { conditions: [RAISED] }),
        event('guards_search', {
          when: { at: null, conditions: [RAISED], delay: null },
          effects: [{ type: 'flag_set', flag: 'raid_over' }],
        }),
      ],
    })
    const { play } = buildService([
      ruling({ label: 'moment' }),
      streamed('You ring the bell.'),
      extracted({ scenario_flags: ['alarm_raised'] }),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I ring the bell.' })

    assert.deepEqual(
      turn.eventsFired?.state.map(({ event: reference }) => reference),
      ['caught']
    )
    const state = await WorldState.findByOrFail('sessionId', sessionId)
    assert.notProperty(state.narrativeFlags, 'raid_over')
  })
})

test.group('Deadlines | the epilogue', (group) => {
  useTransaction(group)

  const SAVED = event('princess_saved', {
    when: { at: null, conditions: [{ type: 'flag', flag: 'alarm_raised' }], delay: null },
    description: 'The princess is free, and the house rings with the alarm.',
    effects: [{ type: 'game_ended', outcome: 'completed' }],
  })
  const ringTheBell = (...epilogue: (string | Error)[]) => [
    ruling({ label: 'moment' }),
    streamed('You ring the bell.'),
    extracted({ scenario_flags: ['alarm_raised'] }),
    streamed(...epilogue),
  ]

  test('told once the end is committed, streamed, kept with the turn', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({ events: [SAVED] })
    const { play, events, messageOf } = buildService(
      ringTheBell('The princess walks free ', 'into the morning.')
    )

    const turn = await play({ sessionId, userId, playerInput: 'I ring the bell.' })

    assert.equal(turn.epilogue, 'The princess walks free into the morning.')
    assert.deepEqual(events.sequenceOf(turn.id), [
      'step_started:arbitration',
      'step_started:narration',
      'narration_chunk',
      'step_started:epilogue',
      'epilogue_chunk',
      'epilogue_chunk',
      'turn_completed',
    ])
    /** Told what ended the story, and never a number. */
    const message = messageOf('epilogue').userMessage
    assert.include(message, '"reason":"victory"')
    assert.include(message, 'The princess is free')
    assert.notInclude(message, 'hit_points')
    /** Its cost counts with the turn's. */
    assert.include(
      (turn.llmUsage ?? []).map(({ step }) => step),
      'epilogue'
    )
  })

  test('failing, it leaves the end standing, untold', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse({ events: [SAVED] })
    const { play, events } = buildService(ringTheBell('The princess', new Error('cut')))

    const turn = await play({ sessionId, userId, playerInput: 'I ring the bell.' })

    assert.equal(turn.status, 'completed')
    assert.isNull(turn.epilogue)
    assert.equal(events.sequenceOf(turn.id).at(-1), 'turn_completed')
    const game = await Session.findOrFail(sessionId)
    assert.equal(game.endReason, 'victory')
  })

  test('no end, no epilogue', async ({ assert }) => {
    const { userId, sessionId } = await arrangeHouse()
    const { play, events } = buildService([
      ruling({ label: 'moment' }),
      streamed('You wait.'),
      extracted(),
    ])

    const turn = await play({ sessionId, userId, playerInput: 'I wait.' })

    assert.notInclude(events.sequenceOf(turn.id), 'step_started:epilogue')
    assert.isNull(turn.epilogue)
  })
})
