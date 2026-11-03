import { test } from '@japa/runner'

import { DAY } from '#services/game/game_time'
import type { ScheduleEntry } from '#services/game/content/types'
import {
  entryAt,
  lastEntryAt,
  movesWithin,
  nextArrivalIn,
  nextDepartureFrom,
  scheduledNpcs,
} from '#services/game/schedules'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'

const HOUR = 3600

/** A vampire: in the castle hall from dusk to night, in the tomb from dawn to the afternoon. */
const VAMPIRE: ScheduleEntry[] = [
  {
    periods: ['dawn', 'morning', 'midday', 'afternoon'],
    location: 'tomb',
    activity: 'lies in his coffin',
    leavesScene: true,
    interrupts: false,
  },
  {
    periods: ['dusk', 'evening', 'night'],
    location: 'castle_hall',
    activity: 'paces the hall',
    leavesScene: false,
    interrupts: true,
  },
]

/** The Cardinal: in the courtyard in the morning, and nowhere said the rest of the day. */
const CARDINAL: ScheduleEntry[] = [
  {
    periods: ['morning'],
    location: 'courtyard',
    activity: 'reviews his guards',
    leavesScene: false,
    interrupts: false,
  },
]

test.group('Schedules | where someone is', () => {
  test('the entry of the period the clock stands in', ({ assert }) => {
    assert.equal(entryAt(VAMPIRE, 10 * HOUR)?.location, 'tomb')
    assert.equal(entryAt(VAMPIRE, 23 * HOUR)?.location, 'castle_hall')
    /** Past midnight, still the night: the castle. */
    assert.equal(entryAt(VAMPIRE, DAY + 2 * HOUR)?.location, 'castle_hall')
  })

  test('a period no entry covers has no entry of its own', ({ assert }) => {
    assert.isNull(entryAt(CARDINAL, 15 * HOUR))
  })

  test('where the schedule last sent them, for someone not met yet', ({ assert }) => {
    /** In the afternoon, the Cardinal was last sent to the courtyard, this morning. */
    assert.equal(lastEntryAt(CARDINAL, 15 * HOUR)?.location, 'courtyard')
    /** At night too: the morning before is the last entry, looking back through the day. */
    assert.equal(lastEntryAt(CARDINAL, 23 * HOUR)?.location, 'courtyard')
    assert.isNull(lastEntryAt([], 10 * HOUR))
  })

  test('only unique people with a schedule an event did not stop', ({ assert }) => {
    const world = {
      ...THREE_MUSKETEERS,
      npcs: THREE_MUSKETEERS.npcs.map((npc) =>
        npc.reference === 'treville' && npc.kind === 'unique'
          ? { ...npc, schedule: CARDINAL }
          : npc.reference === 'athos' && npc.kind === 'unique'
            ? { ...npc, schedule: VAMPIRE }
            : npc
      ),
    }

    assert.sameMembers(
      scheduledNpcs(world, new Set()).map(({ reference }) => reference),
      ['treville', 'athos']
    )
    assert.sameMembers(
      scheduledNpcs(world, new Set(['athos'])).map(({ reference }) => reference),
      ['treville']
    )
  })
})

test.group('Schedules | comings and goings', () => {
  test('a change of place at each period that sends them elsewhere', ({ assert }) => {
    /** From noon to the next noon: to the hall at dusk, back to the tomb at dawn. */
    const moves = movesWithin(VAMPIRE, 12 * HOUR, DAY + 12 * HOUR)

    assert.deepEqual(
      moves.map(({ at, entry }) => [at, entry.location]),
      [
        [18 * HOUR, 'castle_hall'],
        [DAY + 5 * HOUR, 'tomb'],
      ]
    )
  })

  test('a period with no entry leaves them where they are', ({ assert }) => {
    /** The Cardinal goes to the courtyard each morning, and is never sent away. */
    assert.deepEqual(
      movesWithin(CARDINAL, 6 * HOUR, 2 * DAY).map(({ at }) => at),
      []
    )
    assert.deepEqual(
      movesWithin(CARDINAL, 0, 8 * HOUR).map(({ at }) => at),
      []
    )
  })

  test('the next arrival in a place, within a window', ({ assert }) => {
    assert.equal(nextArrivalIn(VAMPIRE, 'castle_hall', 10 * HOUR, DAY)?.at, 18 * HOUR)
    assert.isNull(nextArrivalIn(VAMPIRE, 'castle_hall', 10 * HOUR, 17 * HOUR))
    /** Already there: no arrival until he has left and come back. */
    assert.equal(nextArrivalIn(VAMPIRE, 'castle_hall', 20 * HOUR, 2 * DAY)?.at, DAY + 18 * HOUR)
  })

  test('the next departure from a place', ({ assert }) => {
    assert.equal(nextDepartureFrom(VAMPIRE, 'castle_hall', 20 * HOUR, 2 * DAY)?.at, DAY + 5 * HOUR)
    assert.isNull(nextDepartureFrom(VAMPIRE, 'castle_hall', 10 * HOUR, 12 * HOUR))
  })
})
