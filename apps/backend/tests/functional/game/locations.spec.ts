import { test } from '@japa/runner'

import LocationInstance from '#models/location_instance'
import { THREE_MUSKETEERS } from '#services/game/world'
import {
  UnknownLocationError,
  improviseLocation,
  visitUniqueLocation,
} from '#services/game/locations'
import { countRows, createSession, createUser, useTransaction } from '#tests/helpers/database'

const TAVERN_IN_MEUNG = {
  definition: 'tavern',
  parent: 'meung_sur_loire',
  name: null,
  descriptor: 'a smoky room with low beams',
}

test.group('Locations | unique places', (group) => {
  useTransaction(group)

  test('get their instance on the first visit, under their own reference', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const paris = await visitUniqueLocation(THREE_MUSKETEERS, sessionId, 'paris')

    assert.equal(paris.handle, 'paris')
    assert.equal(paris.definitionReference, 'paris')
    /** Its parent is part of its definition, not of the instance. */
    assert.isNull(paris.parentReference)
  })

  test('are never duplicated', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const first = await visitUniqueLocation(THREE_MUSKETEERS, sessionId, 'paris')
    const again = await visitUniqueLocation(THREE_MUSKETEERS, sessionId, 'paris')

    assert.equal(again.id, first.id)
    assert.equal(await countRows('location_instances', { session_id: sessionId }), 1)
  })

  test('are instanced once per game, not once overall', async ({ assert }) => {
    const userId = await createUser()

    const mine = await visitUniqueLocation(THREE_MUSKETEERS, await createSession(userId), 'paris')
    const other = await visitUniqueLocation(THREE_MUSKETEERS, await createSession(userId), 'paris')

    assert.notEqual(other.id, mine.id)
  })

  test('only come from the unique places of the world', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    await assert.rejects(
      () => visitUniqueLocation(THREE_MUSKETEERS, sessionId, 'tavern'),
      UnknownLocationError
    )
    await assert.rejects(
      () => visitUniqueLocation(THREE_MUSKETEERS, sessionId, 'noble_quarter'),
      UnknownLocationError
    )
  })
})

test.group('Locations | improvised places', (group) => {
  useTransaction(group)

  test('are instances of an archetype, set in a unique place', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const tavern = await improviseLocation(THREE_MUSKETEERS, sessionId, TAVERN_IN_MEUNG)
    const reloaded = await LocationInstance.findOrFail(tavern.id)

    assert.equal(reloaded.handle, 'tavern_1')
    assert.equal(reloaded.definitionReference, 'tavern')
    assert.equal(reloaded.parentReference, 'meung_sur_loire')
    assert.equal(reloaded.descriptor, TAVERN_IN_MEUNG.descriptor)
    assert.isNull(reloaded.name)
  })

  test('are numbered by the backend, per archetype and per game', async ({ assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)

    const first = await improviseLocation(THREE_MUSKETEERS, sessionId, TAVERN_IN_MEUNG)
    const town = await improviseLocation(THREE_MUSKETEERS, sessionId, {
      definition: 'town',
      parent: 'france',
      name: 'Orléans',
      descriptor: null,
    })
    const second = await improviseLocation(THREE_MUSKETEERS, sessionId, TAVERN_IN_MEUNG)
    const elsewhere = await improviseLocation(
      THREE_MUSKETEERS,
      await createSession(userId),
      TAVERN_IN_MEUNG
    )

    assert.deepEqual(
      [first.handle, town.handle, second.handle, elsewhere.handle],
      ['tavern_1', 'town_1', 'tavern_2', 'tavern_1']
    )
  })

  test('only come from the archetypes of the world', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    for (const definition of ['paris', 'secret_lair']) {
      await assert.rejects(
        () => improviseLocation(THREE_MUSKETEERS, sessionId, { ...TAVERN_IN_MEUNG, definition }),
        UnknownLocationError
      )
    }
  })

  test('only sit in a unique place of the world', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    for (const parent of ['tavern', 'orleans']) {
      await assert.rejects(
        () => improviseLocation(THREE_MUSKETEERS, sessionId, { ...TAVERN_IN_MEUNG, parent }),
        UnknownLocationError
      )
    }

    assert.equal(await countRows('location_instances', { session_id: sessionId }), 0)
  })
})
