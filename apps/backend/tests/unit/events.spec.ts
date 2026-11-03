import { test } from '@japa/runner'

import { DAY } from '#services/game/game_time'
import type { ScenarioEvent } from '#services/game/content/types'
import {
  type EventProgress,
  NOT_STARTED,
  type WorldSnapshot,
  awaitedTimeOf,
  dueTimeOf,
  foreseeableEvents,
  holds,
  momentOf,
  stateEventsDue,
  timedEventsDue,
  witnesses,
} from '#services/game/events'

const HOUR = 3600

function event(reference: string, rest: Partial<ScenarioEvent> = {}): ScenarioEvent {
  return {
    reference,
    when: { at: null, conditions: [], delay: null },
    unless: [],
    place: null,
    description: `${reference}, for a spec.`,
    effects: [{ type: 'flag_set', flag: `${reference}_done` }],
    interrupts: false,
    foreseeable: null,
    ...rest,
  }
}

/** On the third night, the goblins attack the camp — unless the elves were warned. */
const GOBLINS = event('goblins_attack', {
  when: { at: { day: 3, period: 'night', time: null }, conditions: [], delay: null },
  unless: [{ type: 'flag', flag: 'elves_warned' }],
  place: 'elf_camp',
  interrupts: true,
})

/** An hour after the egg is taken, the dragon wakes. */
const DRAGON = event('dragon_wakes', {
  when: {
    at: null,
    conditions: [{ type: 'item_held_by', item: 'dragon_egg', holder: { holder: 'character' } }],
    delay: { label: 'hour' },
  },
  place: 'dragon_lair',
})

/** As soon as the Cardinal is at the inn, his carriage stands in the stables. */
const CARRIAGE = event('carriage_in_stables', {
  when: {
    at: null,
    conditions: [{ type: 'npc_at', npc: 'cardinal', location: 'inn' }],
    delay: null,
  },
  effects: [
    {
      type: 'item_placed',
      item: 'carriage',
      holder: { holder: 'location', reference: 'stables' },
      quantity: 1,
    },
  ],
})

function snapshot(rest: Partial<WorldSnapshot> = {}): WorldSnapshot {
  return { flags: new Set(), visited: new Set(), npcs: new Map(), items: new Map(), ...rest }
}

const nothingYet = (): EventProgress => NOT_STARTED

test.group('Events | conditions', () => {
  test('each kind of condition reads the state', ({ assert }) => {
    const state = snapshot({
      flags: new Set(['elves_warned']),
      visited: new Set(['inn']),
      npcs: new Map([
        ['cardinal', { status: 'absent', disposition: 'hostile', place: 'inn' }],
        ['rochefort', { status: 'dead', disposition: 'hostile', place: null }],
      ]),
      items: new Map([
        ['dragon_egg', { holder: { holder: 'character' }, gone: false }],
        ['letter', { holder: { holder: 'npc', reference: 'cardinal' }, gone: false }],
        ['studs', { holder: null, gone: true }],
      ]),
    })

    assert.isTrue(holds({ type: 'flag', flag: 'elves_warned' }, state))
    assert.isFalse(holds({ type: 'flag', flag: 'camp_burnt' }, state))
    assert.isTrue(holds({ type: 'location_visited', location: 'inn' }, state))
    assert.isTrue(holds({ type: 'npc_dead', npc: 'rochefort' }, state))
    assert.isFalse(holds({ type: 'npc_dead', npc: 'cardinal' }, state))
    assert.isTrue(
      holds({ type: 'npc_disposition', npc: 'cardinal', disposition: 'hostile' }, state)
    )
    assert.isTrue(holds({ type: 'npc_at', npc: 'cardinal', location: 'inn' }, state))
    assert.isFalse(holds({ type: 'npc_at', npc: 'rochefort', location: 'inn' }, state))
    assert.isTrue(
      holds({ type: 'item_held_by', item: 'dragon_egg', holder: { holder: 'character' } }, state)
    )
    assert.isTrue(
      holds(
        { type: 'item_held_by', item: 'letter', holder: { holder: 'npc', reference: 'cardinal' } },
        state
      )
    )
    assert.isTrue(holds({ type: 'item_gone', item: 'studs' }, state))
    /** Someone or something the game has not met holds nothing, and is nowhere. */
    assert.isFalse(holds({ type: 'npc_at', npc: 'milady', location: 'inn' }, state))
    assert.isFalse(holds({ type: 'item_gone', item: 'seal' }, state))
  })
})

test.group('Events | the clock', () => {
  test('a deadline falls at the start of its period, or at its time, on its day', ({ assert }) => {
    assert.equal(momentOf({ day: 3, period: 'night', time: null }), 2 * DAY + 22 * HOUR)
    assert.equal(momentOf({ day: 1, period: null, time: '06:30' }), 6.5 * HOUR)
    assert.equal(momentOf({ day: 2, period: null, time: null }), DAY)
  })

  test('a delayed event falls once armed, after its delay', ({ assert }) => {
    assert.isNull(dueTimeOf(DRAGON, NOT_STARTED))
    assert.equal(dueTimeOf(DRAGON, { ...NOT_STARTED, armedAt: 10 * HOUR }), 11 * HOUR)
  })

  test('a deadline falls once the clock reaches it, not before', ({ assert }) => {
    const before = timedEventsDue([GOBLINS], nothingYet, snapshot(), 2 * DAY + 21 * HOUR)
    const after = timedEventsDue([GOBLINS], nothingYet, snapshot(), 2 * DAY + 23 * HOUR)

    assert.lengthOf(before, 0)
    assert.deepEqual(
      after.map(({ event: due, at, outcome }) => [due.reference, at, outcome]),
      [['goblins_attack', 2 * DAY + 22 * HOUR, 'fired']]
    )
  })

  test('an unless that holds cancels it as it falls due', ({ assert }) => {
    const due = timedEventsDue(
      [GOBLINS],
      nothingYet,
      snapshot({ flags: new Set(['elves_warned']) }),
      3 * DAY
    )

    assert.deepEqual(
      due.map(({ outcome }) => outcome),
      ['cancelled']
    )
  })

  test('an event settled never falls again', ({ assert }) => {
    const fired = () => ({ ...NOT_STARTED, firedAt: 2 * DAY + 22 * HOUR })

    assert.lengthOf(timedEventsDue([GOBLINS], fired, snapshot(), 5 * DAY), 0)
  })

  test('a deadline waiting on conditions falls once they hold', ({ assert }) => {
    const ball = event('the_ball', {
      when: {
        at: { day: 1, period: 'evening', time: null },
        conditions: [{ type: 'flag', flag: 'invited' }],
        delay: null,
      },
    })

    assert.lengthOf(timedEventsDue([ball], nothingYet, snapshot(), DAY), 0)
    assert.lengthOf(
      timedEventsDue([ball], nothingYet, snapshot({ flags: new Set(['invited']) }), DAY),
      1
    )
  })

  test('several fall in the order of the clock', ({ assert }) => {
    const dawn = event('dawn_bells', {
      when: { at: { day: 3, period: 'dawn', time: null }, conditions: [], delay: null },
    })
    const due = timedEventsDue([GOBLINS, dawn], nothingYet, snapshot(), 4 * DAY)

    assert.deepEqual(
      due.map(({ event: fallen }) => fallen.reference),
      ['dawn_bells', 'goblins_attack']
    )
  })
})

test.group('Events | the state', () => {
  const holding = snapshot({
    items: new Map([['dragon_egg', { holder: { holder: 'character' }, gone: false }]]),
    npcs: new Map([['cardinal', { status: 'absent', disposition: 'neutral', place: 'inn' }]]),
  })

  test('sets off at once an event whose conditions hold', ({ assert }) => {
    const due = stateEventsDue([CARRIAGE, DRAGON], nothingYet, holding)

    assert.deepEqual(
      due.fire.map(({ reference }) => reference),
      ['carriage_in_stables']
    )
    /** One with a delay is armed instead, to fall when it is over. */
    assert.deepEqual(
      due.arm.map(({ reference }) => reference),
      ['dragon_wakes']
    )
  })

  test('nothing while the conditions do not hold', ({ assert }) => {
    const due = stateEventsDue([CARRIAGE, DRAGON], nothingYet, snapshot())

    assert.lengthOf([...due.fire, ...due.arm, ...due.cancel], 0)
  })

  test('an armed event is not armed again, nor a deadline set off by the state', ({ assert }) => {
    const armed = () => ({ ...NOT_STARTED, armedAt: 10 * HOUR })
    const due = stateEventsDue([DRAGON, GOBLINS], armed, holding)

    assert.lengthOf([...due.fire, ...due.arm, ...due.cancel], 0)
  })

  test('an unless that holds cancels it', ({ assert }) => {
    const spared = { ...CARRIAGE, unless: [{ type: 'flag' as const, flag: 'cardinal_on_foot' }] }
    const due = stateEventsDue([spared], nothingYet, {
      ...holding,
      flags: new Set(['cardinal_on_foot']),
    })

    assert.deepEqual(
      due.cancel.map(({ reference }) => reference),
      ['carriage_in_stables']
    )
  })
})

test.group('Events | what the character sees and knows', () => {
  test('an event is seen where it happens, or in a place containing it', ({ assert }) => {
    assert.isTrue(witnesses(GOBLINS, ['elf_camp', 'forest']))
    assert.isFalse(witnesses(GOBLINS, ['city', 'kingdom']))
    /** Felt everywhere: bells, a storm. */
    assert.isTrue(witnesses(event('storm'), []))
  })

  test('only what the character knows is coming may be waited for', ({ assert }) => {
    const arrival = event('cardinal_arrives', {
      when: { at: { day: 2, period: 'evening', time: null }, conditions: [], delay: null },
      foreseeable: [{ type: 'flag', flag: 'arrival_announced' }],
    })
    const always = event('mass', {
      when: { at: { day: 1, period: 'midday', time: null }, conditions: [], delay: null },
      foreseeable: [],
    })

    assert.deepEqual(
      foreseeableEvents([GOBLINS, arrival, always], nothingYet, snapshot()).map(
        ({ reference }) => reference
      ),
      ['mass']
    )
    assert.deepEqual(
      foreseeableEvents(
        [GOBLINS, arrival, always],
        nothingYet,
        snapshot({ flags: new Set(['arrival_announced']) })
      ).map(({ reference }) => reference),
      ['cardinal_arrives', 'mass']
    )
  })

  test('a wait ends when the event falls, if it does within the wait', ({ assert }) => {
    const window = { from: 2 * DAY, until: 9 * DAY }

    assert.equal(awaitedTimeOf(GOBLINS, NOT_STARTED, snapshot(), window), 2 * DAY + 22 * HOUR)
    /** Cancelled before it falls, or too far off: it never comes. */
    assert.isNull(
      awaitedTimeOf(GOBLINS, NOT_STARTED, snapshot({ flags: new Set(['elves_warned']) }), window)
    )
    assert.isNull(awaitedTimeOf(GOBLINS, NOT_STARTED, snapshot(), { from: 0, until: DAY }))
    /** An event of the state not armed yet: nothing says when. */
    assert.isNull(awaitedTimeOf(DRAGON, NOT_STARTED, snapshot(), window))
  })
})
