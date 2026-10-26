import { test } from '@japa/runner'

import {
  keyOf,
  networkContainers,
  networkPlaces,
  networksOf,
  waysOutOf,
} from '#services/game/passages'
import { HOUSE_PLACES, HOUSE_WORLD } from '#tests/helpers/places'

test.group('Passages | read from either side', () => {
  test('a place has the exits it declares', ({ assert }) => {
    assert.deepEqual(
      waysOutOf(HOUSE_PLACES, 'house_yard').map(({ to, passage }) => [to, passage]),
      [['house_hall', 'the front door']]
    )
  })

  test('a passage declared on one side leads back from the other', ({ assert }) => {
    const fromHall = waysOutOf(HOUSE_PLACES, 'house_hall').map(({ to }) => to)
    const fromKitchen = waysOutOf(HOUSE_PLACES, 'house_kitchen').map(({ to }) => to)

    assert.sameMembers(fromHall, [
      'house_yard',
      'house_kitchen',
      'house_corridor',
      'house_study',
      'house_cellar',
    ])
    assert.sameMembers(fromKitchen, ['house_cellar', 'house_hall'])
  })

  test('read from the other side, with its own text when it has one', ({ assert }) => {
    const down = waysOutOf(HOUSE_PLACES, 'house_corridor').find(({ to }) => to === 'house_hall')!
    const back = waysOutOf(HOUSE_PLACES, 'house_kitchen').find(({ to }) => to === 'house_hall')!

    assert.equal(down.passage, 'the main staircase, going down')
    assert.equal(down.duration, 'minutes')
    /** No text of its own: the same words read both ways. */
    assert.equal(back.passage, 'a swing door')
    assert.deepEqual(back.declared, { from: 'house_hall', to: 'house_kitchen' })
  })

  test('hidden from the side that declares it so, never from the other', ({ assert }) => {
    const fromStudy = waysOutOf(HOUSE_PLACES, 'house_study').find(
      ({ to }) => to === 'house_cellar'
    )!
    const fromCellar = waysOutOf(HOUSE_PLACES, 'house_cellar').find(
      ({ to }) => to === 'house_study'
    )!

    assert.isTrue(fromStudy.hidden)
    assert.isFalse(fromCellar.hidden)
    assert.equal(fromCellar.passage, 'a narrow door at the top of the steps')
  })

  test('a locked passage is locked from both sides', ({ assert }) => {
    const fromStudy = waysOutOf(HOUSE_PLACES, 'house_study').find(({ to }) => to === 'house_hall')!

    assert.equal(fromStudy.requires, 'iron_key')
  })

  test('a one-way passage leads one way only', ({ assert }) => {
    assert.include(
      waysOutOf(HOUSE_PLACES, 'house_cellar').map(({ to }) => to),
      'house_vault'
    )
    assert.deepEqual(waysOutOf(HOUSE_PLACES, 'house_vault'), [])
  })

  test('a passage is named by the pair that declares it', ({ assert }) => {
    assert.equal(keyOf({ from: 'house_hall', to: 'house_kitchen' }), 'house_hall>house_kitchen')
  })

  test('a resolved world reads the same as its content', ({ assert }) => {
    assert.deepEqual(
      waysOutOf(HOUSE_WORLD.locations, 'house_hall'),
      waysOutOf(HOUSE_PLACES, 'house_hall')
    )
  })
})

test.group('Passages | networks', () => {
  test('the places joined by passages make one network', ({ assert }) => {
    const networks = networksOf(HOUSE_PLACES)

    assert.lengthOf(networks, 1)
    assert.sameMembers([...networks[0]], [...networkPlaces(HOUSE_PLACES)])
    assert.notInclude([...networks[0]], 'house')
  })

  test('the place around a network contains it without being part of it', ({ assert }) => {
    assert.deepEqual([...networkContainers(HOUSE_WORLD.locations)], ['house'])
  })

  test('a world without exits has no network', ({ assert }) => {
    const free = HOUSE_PLACES.map((place) => ({ ...place, exits: [] }))

    assert.deepEqual(networksOf(free), [])
    assert.deepEqual([...networkContainers(free)], [])
  })
})
