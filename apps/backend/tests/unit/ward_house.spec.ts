import { test } from '@japa/runner'

import { LOVECRAFT_MYTHOS_CONTENT } from '#database/content/lovecraft_mythos'
import { resolveWorld } from '#services/game/content/resolve'
import { checkScenario } from '#services/game/content/coherence'
import { keyOf } from '#services/game/passages'
import { type TravelState, destinationsFrom, placeKindOf, routesFrom } from '#services/game/travel'

const { scenarios, ...MYTHOS } = LOVECRAFT_MYTHOS_CONTENT
const INHERITANCE = scenarios.find(({ reference }) => reference === 'the_ward_inheritance')!
const PLACES = resolveWorld(MYTHOS, INHERITANCE).locations

const ROOMS = INHERITANCE.locations
  .filter(({ parent }) => parent === 'ward_house' || parent === 'ward_laboratory')
  .map(({ reference }) => reference)

const HIDDEN_DOOR = keyOf({ from: 'ward_house_cellar', to: 'ward_laboratory' })

/** A game that has been everywhere in the house, knowing what `rest` says. */
function everywhere(rest: Partial<TravelState> = {}): TravelState {
  return {
    visited: new Set(ROOMS),
    passages: { discovered: new Set(), unlocked: new Set() },
    held: new Set(),
    guarded: new Set(),
    ...rest,
  }
}

test.group('The Ward House | its network', () => {
  test('holds together', ({ assert }) => {
    assert.deepEqual(checkScenario(MYTHOS, INHERITANCE), [])
  })

  test('the housekeeper waits in the kitchen, Silas in the sealed vault', ({ assert }) => {
    const placed = Object.fromEntries(
      INHERITANCE.npcs
        .filter(({ initialLocation }) => initialLocation !== null)
        .map(({ reference, initialLocation }) => [reference, initialLocation])
    )

    assert.deepEqual(placed, { martha_pike: 'ward_house_kitchen', silas_ward: 'sealed_vault' })
  })

  test('every room is part of it; the house only contains them', ({ assert }) => {
    for (const room of ROOMS) {
      assert.include(['network', 'entrance'], placeKindOf(PLACES, room), room)
    }
    assert.equal(placeKindOf(PLACES, 'ward_house'), 'container')
  })

  test('entered by the drive or by the back door', ({ assert }) => {
    const { places } = destinationsFrom(PLACES, 'cold_spring', everywhere())

    assert.includeMembers(places, ['ward_house_grounds', 'ward_house_kitchen', 'arkham'])
    assert.notInclude(places, 'ward_house')
    assert.notInclude(places, 'ward_house_entrance_hall')
  })

  test('the laboratory lies behind a door hidden in the cellar', ({ assert }) => {
    const unfound = routesFrom(PLACES, 'ward_house_cellar', everywhere())
    const found = routesFrom(
      PLACES,
      'ward_house_cellar',
      everywhere({ passages: { discovered: new Set([HIDDEN_DOOR]), unlocked: new Set() } })
    )

    assert.isFalse(unfound.has('ward_laboratory'))
    assert.isTrue(found.has('ward_laboratory'))
  })

  test('the vault takes the iron key', ({ assert }) => {
    const found = { discovered: new Set([HIDDEN_DOOR]), unlocked: new Set<string>() }

    assert.isFalse(
      routesFrom(PLACES, 'ward_laboratory', everywhere({ passages: found })).has('sealed_vault')
    )
    assert.isTrue(
      routesFrom(
        PLACES,
        'ward_laboratory',
        everywhere({ passages: found, held: new Set(['iron_vault_key']) })
      ).has('sealed_vault')
    )
  })

  test('from the drive to the vault, by the exits only', ({ assert }) => {
    const route = routesFrom(
      PLACES,
      'ward_house_grounds',
      everywhere({
        passages: { discovered: new Set([HIDDEN_DOOR]), unlocked: new Set() },
        held: new Set(['iron_vault_key']),
      })
    ).get('sealed_vault')!

    assert.deepEqual(
      route.steps.map(({ to }) => to),
      [
        'ward_house_entrance_hall',
        'ward_house_kitchen',
        'ward_house_cellar',
        'ward_laboratory',
        'sealed_vault',
      ]
    )
  })

  test('the story starts in the entrance hall, the rest still to discover', ({ assert }) => {
    const { places, improvise } = destinationsFrom(
      PLACES,
      'ward_house_entrance_hall',
      everywhere({ visited: new Set(['ward_house_entrance_hall']) })
    )

    assert.isFalse(improvise)
    assert.sameMembers(places, [
      'ward_house_grounds',
      'ward_house_parlour',
      'ward_house_dining_room',
      'ward_house_library',
      'ward_house_upstairs_corridor',
      'ward_house_kitchen',
    ])
  })
})
