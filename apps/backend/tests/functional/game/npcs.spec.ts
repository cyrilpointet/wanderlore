import { test } from '@japa/runner'

import { THREE_MUSKETEERS } from '#services/game/world'
import { DeadNpcError, UnknownNpcError, enterScene, presentNpcs } from '#services/game/npcs'
import { countRows, createSession, createUser, useTransaction } from '#tests/helpers/database'

const GUARD = { definition: 'cardinal_guard', descriptor: 'a guard with a scar on his cheek' }

test.group('NPCs | entering the scene', (group) => {
  useTransaction(group)

  test('a unique character gets their instance, under their own reference', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const rochefort = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'rochefort',
      descriptor: 'a gentleman with a scar on his temple',
    })

    assert.equal(rochefort.handle, 'rochefort')
    assert.equal(rochefort.definitionReference, 'rochefort')
    assert.equal(rochefort.status, 'present')
    /** Read from the definition, never proposed. */
    assert.equal(rochefort.disposition, 'unfriendly')
  })

  test('a unique character met again is made present, never duplicated', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const first = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'treville',
      descriptor: null,
    })
    first.merge({ status: 'absent', disposition: 'friendly' })
    await first.save()

    const again = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'treville',
      descriptor: 'another description',
    })

    assert.equal(again.id, first.id)
    assert.equal(again.status, 'present')
    /** What the game made of them is kept: they are the same person. */
    assert.equal(again.disposition, 'friendly')
    assert.equal(await countRows('npc_instances', { session_id: sessionId }), 1)
  })

  test('a unique character who died cannot walk back in', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const jussac = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'jussac',
      descriptor: null,
    })
    jussac.status = 'dead'
    await jussac.save()

    await assert.rejects(
      () => enterScene(THREE_MUSKETEERS, sessionId, { definition: 'jussac', descriptor: null }),
      DeadNpcError
    )

    await jussac.refresh()
    assert.equal(jussac.status, 'dead')
  })

  test('an archetype gets a new instance every time, with its descriptor', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const first = await enterScene(THREE_MUSKETEERS, sessionId, GUARD)
    const second = await enterScene(THREE_MUSKETEERS, sessionId, {
      ...GUARD,
      descriptor: 'a young guard, visibly bored',
    })

    assert.deepEqual([first.handle, second.handle], ['cardinal_guard_1', 'cardinal_guard_2'])
    assert.equal(second.descriptor, 'a young guard, visibly bored')
    assert.equal(second.disposition, 'unfriendly')
  })

  test('numbers per archetype and per game', async ({ assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)

    const guard = await enterScene(THREE_MUSKETEERS, sessionId, GUARD)
    const passerBy = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'commoner',
      descriptor: "a baker's apprentice with flour on his sleeves",
    })
    const secondGuard = await enterScene(THREE_MUSKETEERS, sessionId, GUARD)
    const elsewhere = await enterScene(THREE_MUSKETEERS, await createSession(userId), GUARD)

    assert.deepEqual(
      [guard.handle, passerBy.handle, secondGuard.handle, elsewhere.handle],
      ['cardinal_guard_1', 'commoner_1', 'cardinal_guard_2', 'cardinal_guard_1']
    )
  })

  test('only comes from the definitions of the world', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    await assert.rejects(
      () => enterScene(THREE_MUSKETEERS, sessionId, { definition: 'dragon', descriptor: null }),
      UnknownNpcError
    )
    assert.equal(await countRows('npc_instances', { session_id: sessionId }), 0)
  })
})

test.group('NPCs | who is present', (group) => {
  useTransaction(group)

  test('lists the people present, oldest first, as the context carries them', async ({
    assert,
  }) => {
    const sessionId = await createSession(await createUser())
    await enterScene(THREE_MUSKETEERS, sessionId, GUARD)
    const gone = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'commoner',
      descriptor: 'a washerwoman',
    })
    const dead = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'thug',
      descriptor: 'a cutpurse',
    })
    const treville = await enterScene(THREE_MUSKETEERS, sessionId, {
      definition: 'treville',
      descriptor: null,
    })
    treville.name = 'Jean-Armand'
    await treville.save()
    gone.status = 'absent'
    await gone.save()
    dead.status = 'dead'
    await dead.save()

    assert.deepEqual(await presentNpcs(sessionId), [
      {
        handle: 'cardinal_guard_1',
        name: null,
        descriptor: GUARD.descriptor,
        disposition: 'unfriendly',
      },
      { handle: 'treville', name: 'Jean-Armand', descriptor: null, disposition: 'neutral' },
    ])
  })

  test('never lists someone from another game', async ({ assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)
    await enterScene(THREE_MUSKETEERS, await createSession(userId), GUARD)

    assert.deepEqual(await presentNpcs(sessionId), [])
  })
})
