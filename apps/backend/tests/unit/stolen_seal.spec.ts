import { test } from '@japa/runner'

import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { resolveWorld } from '#services/game/content/resolve'
import { checkScenario } from '#services/game/content/coherence'
import { keyOf } from '#services/game/passages'
import { type TravelState, destinationsFrom, placeKindOf, routesFrom } from '#services/game/travel'

const { scenarios, ...MUSKETEERS } = THREE_MUSKETEERS_CONTENT
const STOLEN_SEAL = scenarios.find(({ reference }) => reference === 'the_stolen_seal')!
const PLACES = resolveWorld(MUSKETEERS, STOLEN_SEAL).locations

const ROOMS = STOLEN_SEAL.locations
  .filter(({ parent }) => parent === 'hotel_de_laffemas')
  .map(({ reference }) => reference)

const JIB_DOOR = keyOf({ from: 'laffemas_library', to: 'laffemas_office' })

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

test.group('The Stolen Seal | the Hôtel de Laffemas', () => {
  test('holds together', ({ assert }) => {
    assert.deepEqual(checkScenario(MUSKETEERS, STOLEN_SEAL), [])
  })

  test('fifteen rooms, a courtyard and a garden, all of the network', ({ assert }) => {
    assert.lengthOf(ROOMS, 17)
    for (const room of ROOMS) {
      assert.include(['network', 'entrance'], placeKindOf(PLACES, room), room)
    }
    assert.equal(placeKindOf(PLACES, 'hotel_de_laffemas'), 'container')
  })

  test('starts in the street, before three ways in', ({ assert }) => {
    assert.equal(STOLEN_SEAL.initialState!.location, 'rue_du_cherche_midi')

    const { places } = destinationsFrom(PLACES, 'rue_du_cherche_midi', everywhere())

    assert.includeMembers(places, ['laffemas_courtyard', 'laffemas_kitchen', 'laffemas_garden'])
    assert.notInclude(places, 'hotel_de_laffemas')
    assert.notInclude(places, 'laffemas_office')
  })

  test('the seal lies in the office, the key to it in the guardroom', ({ assert }) => {
    const holders = Object.fromEntries(
      STOLEN_SEAL.items.map(({ reference, initialHolder }) => [reference, initialHolder])
    )

    assert.deepEqual(holders.treville_seal, { holder: 'location', reference: 'laffemas_office' })
    assert.deepEqual(holders.laffemas_office_key, {
      holder: 'location',
      reference: 'laffemas_guardroom',
    })
  })

  test('the office door takes its key; without it, the way is through the bedchamber', ({
    assert,
  }) => {
    const withoutKey = routesFrom(PLACES, 'laffemas_salon', everywhere()).get('laffemas_office')
    const withKey = routesFrom(
      PLACES,
      'laffemas_salon',
      everywhere({ held: new Set(['laffemas_office_key']) })
    ).get('laffemas_office')

    assert.deepEqual(
      withoutKey?.steps.map(({ to }) => to),
      ['laffemas_landing', 'laffemas_bedchamber', 'laffemas_office']
    )
    assert.deepEqual(
      withKey?.steps.map(({ to }) => to),
      ['laffemas_office']
    )
  })

  test('a jib door in the library leads to the office, once found', ({ assert }) => {
    const unfound = routesFrom(PLACES, 'laffemas_library', everywhere()).get('laffemas_office')
    const found = routesFrom(
      PLACES,
      'laffemas_library',
      everywhere({ passages: { discovered: new Set([JIB_DOOR]), unlocked: new Set() } })
    ).get('laffemas_office')

    assert.notDeepEqual(
      unfound?.steps.map(({ to }) => to),
      ['laffemas_office']
    )
    assert.deepEqual(
      found?.steps.map(({ to }) => to),
      ['laffemas_office']
    )
  })

  test('never more than one guard to a room', ({ assert }) => {
    const guards = ['Cahusac', 'Biscarat', 'Bernajoux', 'Jussac', 'off-duty guard']
    for (const place of STOLEN_SEAL.locations) {
      const posted = guards.filter((guard) => place.description.includes(guard))
      assert.isAtMost(posted.length, 1, place.reference)
    }
  })

  test('a guard or a trial in about half of the house, the rest quiet', ({ assert }) => {
    const quiet = STOLEN_SEAL.locations
      .filter(
        ({ parent, description }) =>
          parent === 'hotel_de_laffemas' && /empty|nobody|nothing here/i.test(description)
      )
      .map(({ reference }) => reference)

    assert.sameMembers(quiet, [
      'laffemas_stables',
      'laffemas_armoury',
      'laffemas_vestibule',
      'laffemas_pantry',
      'laffemas_refectory',
      'laffemas_chapel',
      'laffemas_salon',
      'laffemas_library',
    ])
    assert.equal(ROOMS.length - quiet.length, 9)
  })
})
