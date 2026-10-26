import { test } from '@japa/runner'

import { keyOf } from '#services/game/passages'
import { type TravelState, destinationsFrom, placeKindOf, routesFrom } from '#services/game/travel'
import { HOUSE_WORLD } from '#tests/helpers/places'

const PLACES = HOUSE_WORLD.locations

const EVERY_ROOM = [
  'house_yard',
  'house_hall',
  'house_kitchen',
  'house_corridor',
  'house_attic',
  'house_bedroom',
  'house_study',
  'house_cellar',
  'house_vault',
]

/** A game that has been to `visited`, knows nothing of its passages, holds nothing. */
function stateOf(visited: string[], rest: Partial<TravelState> = {}): TravelState {
  return {
    visited: new Set(visited),
    passages: { discovered: new Set(), unlocked: new Set() },
    held: new Set(),
    guarded: new Set(),
    ...rest,
  }
}

function reachable(from: string, state: TravelState): string[] {
  return [...routesFrom(PLACES, from, state).keys()].sort()
}

test.group('Travel | what a place is', () => {
  test('free, in a network, an entrance, or around a network', ({ assert }) => {
    assert.equal(placeKindOf(PLACES, 'paris'), 'free')
    assert.equal(placeKindOf(PLACES, 'house_hall'), 'network')
    assert.equal(placeKindOf(PLACES, 'house_yard'), 'entrance')
    assert.equal(placeKindOf(PLACES, 'house'), 'container')
  })
})

test.group('Travel | reachable places', () => {
  test('a new place is discovered one room at a time', ({ assert }) => {
    assert.deepEqual(reachable('house_yard', stateOf(['house_yard'])), ['house_hall'])
  })

  test('never two new rooms in a row', ({ assert }) => {
    assert.deepEqual(reachable('house_hall', stateOf(['house_yard', 'house_hall'])), [
      'house_cellar',
      'house_corridor',
      'house_kitchen',
      'house_yard',
    ])
  })

  test('a room visited is reached in one turn, however far', ({ assert }) => {
    const route = routesFrom(
      PLACES,
      'house_attic',
      stateOf(['house_yard', 'house_hall', 'house_corridor', 'house_attic'])
    ).get('house_yard')!

    assert.deepEqual(
      route.steps.map(({ to }) => to),
      ['house_corridor', 'house_hall', 'house_yard']
    )
    /** A ladder, the stairs down (ten minutes), the front door. */
    assert.equal(route.seconds, 60 + 600 + 60)
  })

  test('the quickest way, not the shortest', ({ assert }) => {
    const route = routesFrom(PLACES, 'house_hall', stateOf(EVERY_ROOM)).get('house_cellar')!

    /** Through the kitchen in two minutes, rather than an hour down the tunnel. */
    assert.deepEqual(
      route.steps.map(({ to }) => to),
      ['house_kitchen', 'house_cellar']
    )
    assert.equal(route.seconds, 120)
  })

  test('a hidden passage stays shut until it is found', ({ assert }) => {
    const found = {
      discovered: new Set([keyOf({ from: 'house_study', to: 'house_cellar' })]),
      unlocked: new Set<string>(),
    }

    assert.notInclude(reachable('house_study', stateOf(EVERY_ROOM)), 'house_cellar')
    assert.include(
      reachable('house_study', stateOf(EVERY_ROOM, { passages: found })),
      'house_cellar'
    )
  })

  test('seen from the other side, a hidden passage is in sight', ({ assert }) => {
    assert.include(reachable('house_cellar', stateOf(EVERY_ROOM)), 'house_study')
  })

  test('a locked door takes its key, or to have been opened once', ({ assert }) => {
    const opened = {
      discovered: new Set<string>(),
      unlocked: new Set([keyOf({ from: 'house_hall', to: 'house_study' })]),
    }
    const visited = ['house_yard', 'house_hall']

    assert.notInclude(reachable('house_hall', stateOf(visited)), 'house_study')
    assert.include(
      reachable('house_hall', stateOf(visited, { held: new Set(['iron_key']) })),
      'house_study'
    )
    assert.include(reachable('house_hall', stateOf(visited, { passages: opened })), 'house_study')
  })

  test('a one-way passage leads one way only', ({ assert }) => {
    assert.include(reachable('house_cellar', stateOf(EVERY_ROOM)), 'house_vault')
    assert.deepEqual(reachable('house_vault', stateOf(EVERY_ROOM)), [])
  })

  test('someone hostile bars the way through their room, not into it', ({ assert }) => {
    const places = reachable(
      'house_cellar',
      stateOf(EVERY_ROOM, { guarded: new Set(['house_hall']) })
    )

    assert.include(places, 'house_hall')
    assert.include(places, 'house_kitchen')
    assert.notInclude(places, 'house_corridor')
    assert.notInclude(places, 'house_yard')
  })
})

test.group('Travel | destinations', () => {
  test('from a free place: the free places, the entrances, and the improvised', ({ assert }) => {
    const { places, improvise } = destinationsFrom(PLACES, 'paris', stateOf(['paris']))

    assert.isTrue(improvise)
    assert.includeMembers(places, ['paris', 'meung_sur_loire', 'house_yard', 'house_kitchen'])
    assert.notInclude(places, 'house_hall')
    /** Around a network, never in it: no destination. */
    assert.notInclude(places, 'house')
  })

  test('from an improvised place, as from a free one', ({ assert }) => {
    assert.deepEqual(
      destinationsFrom(PLACES, null, stateOf([])),
      destinationsFrom(PLACES, 'paris', stateOf([]))
    )
  })

  test('from a room of a network: its reachable places only, nothing improvised', ({ assert }) => {
    assert.deepEqual(
      destinationsFrom(PLACES, 'house_hall', stateOf(['house_yard', 'house_hall'])),
      {
        places: ['house_yard', 'house_kitchen', 'house_corridor', 'house_cellar'],
        improvise: false,
      }
    )
  })

  test('from an entrance: both', ({ assert }) => {
    const { places, improvise } = destinationsFrom(
      PLACES,
      'house_yard',
      stateOf(['house_yard', 'house_hall'])
    )

    assert.isTrue(improvise)
    assert.includeMembers(places, ['house_hall', 'house_kitchen', 'paris', 'meung_sur_loire'])
    assert.include(places, 'house_corridor')
    assert.notInclude(places, 'house_attic')
    assert.notInclude(places, 'house')
  })
})
