import { test } from '@japa/runner'

import InventoryItem from '#models/inventory_item'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'
import { enterScene } from '#services/game/npcs'
import { visitUniqueLocation } from '#services/game/locations'
import {
  ItemRefusedError,
  UnknownItemError,
  createItem,
  destroyItem,
  equipItem,
  itemsInScene,
  leaveItemsInPlace,
  transferItem,
  unequipItem,
  type Holder,
} from '#services/game/inventory'
import {
  countRows,
  createCharacter,
  createLocationInstance,
  createNpcInstance,
  createSession,
  createUser,
  useTransaction,
} from '#tests/helpers/database'

const world = THREE_MUSKETEERS

/** A game with its character, someone in the scene, and the place it stands in. */
async function scene() {
  const sessionId = await createSession(await createUser())
  const character: Holder = { type: 'character', id: await createCharacter(sessionId) }
  const npc: Holder = {
    type: 'npc',
    id: await createNpcInstance(sessionId, 'rochefort', { definitionReference: 'rochefort' }),
  }
  const location: Holder = { type: 'location', id: await createLocationInstance(sessionId) }

  return { sessionId, character, npc, location }
}

function one(definition: string, descriptor: string | null = null) {
  return { definition, descriptor, quantity: 1 }
}

test.group('Inventory | items coming into being', (group) => {
  useTransaction(group)

  test('a unique item exists under its own reference, once per game', async ({ assert }) => {
    const { sessionId, character, location } = await scene()

    const letter = await createItem(world, sessionId, one('letter_to_treville'), character)

    assert.equal(letter.handle, 'letter_to_treville')
    assert.equal(letter.characterId, character.id)
    assert.equal(letter.state, 'carried')
    await assert.rejects(
      () => createItem(world, sessionId, one('letter_to_treville'), location),
      ItemRefusedError
    )

    /** Not even once the first one is destroyed: there was only ever one. */
    await destroyItem(world, letter, 1)
    await assert.rejects(
      () => createItem(world, sessionId, one('letter_to_treville'), character),
      ItemRefusedError
    )
  })

  test('a copy of an archetype gets its own handle, numbered per game', async ({ assert }) => {
    const { sessionId, character, npc } = await scene()

    const first = await createItem(world, sessionId, one('rapier'), character)
    const stool = await createItem(
      world,
      sessionId,
      one('improvised_weapon', 'a three-legged stool'),
      character
    )
    const second = await createItem(world, sessionId, one('rapier'), npc)
    const otherGame = await scene()
    const elsewhere = await createItem(
      world,
      otherGame.sessionId,
      one('rapier'),
      otherGame.character
    )

    assert.deepEqual(
      [first.handle, stool.handle, second.handle, elsewhere.handle],
      ['rapier_1', 'improvised_weapon_1', 'rapier_2', 'rapier_1']
    )
    assert.equal(stool.descriptor, 'a three-legged stool')
  })

  test('a stack adds up for its holder', async ({ assert }) => {
    const { sessionId, character } = await scene()

    const first = await createItem(
      world,
      sessionId,
      { definition: 'lead_shot', descriptor: null, quantity: 6 },
      character
    )
    const again = await createItem(
      world,
      sessionId,
      { definition: 'lead_shot', descriptor: null, quantity: 4 },
      character
    )

    assert.equal(again.id, first.id)
    assert.isNull(again.handle)
    assert.equal(again.quantity, 10)
  })

  test('only a stack counts more than one, and never less than one', async ({ assert }) => {
    const { sessionId, character } = await scene()

    await assert.rejects(
      () =>
        createItem(
          world,
          sessionId,
          { definition: 'rapier', descriptor: null, quantity: 2 },
          character
        ),
      ItemRefusedError
    )
    await assert.rejects(
      () =>
        createItem(
          world,
          sessionId,
          { definition: 'food', descriptor: null, quantity: 0 },
          character
        ),
      ItemRefusedError
    )
    assert.equal(await countRows('inventory_items', { session_id: sessionId }), 0)
  })

  test('only comes from the definitions of the world', async ({ assert }) => {
    const { sessionId, character } = await scene()

    await assert.rejects(
      () => createItem(world, sessionId, one('magic_ring'), character),
      UnknownItemError
    )
  })
})

test.group('Inventory | changing hands', (group) => {
  useTransaction(group)

  test('a copy keeps its handle from one holder to the next', async ({ assert }) => {
    const { sessionId, character, npc, location } = await scene()
    const letter = await createItem(world, sessionId, one('letter_to_treville'), character)

    /** Rochefort takes the letter… */
    await transferItem(world, letter, npc, 1)
    await letter.refresh()
    assert.equal(letter.npcInstanceId, npc.id)
    assert.isNull(letter.characterId)

    /** …and hides it in the place, where it can be found again. */
    await transferItem(world, letter, location, 1)
    await transferItem(world, letter, character, 1)
    await letter.refresh()

    assert.equal(letter.handle, 'letter_to_treville')
    assert.equal(letter.characterId, character.id)
    assert.isNull(letter.locationInstanceId)
    assert.equal(await countRows('inventory_items', { session_id: sessionId }), 1)
  })

  test('an item leaving the character is no longer equipped', async ({ assert }) => {
    const { sessionId, character, npc } = await scene()
    const sword = await createItem(world, sessionId, one('rapier'), character)
    await equipItem(world, sword)

    await transferItem(world, sword, npc, 1)
    await sword.refresh()

    assert.equal(sword.state, 'carried')
  })

  test('a stack is split, then merged back', async ({ assert }) => {
    const { sessionId, character, npc } = await scene()
    const shot = await createItem(
      world,
      sessionId,
      { definition: 'lead_shot', descriptor: null, quantity: 10 },
      character
    )

    const given = await transferItem(world, shot, npc, 4)
    await shot.refresh()
    assert.equal(given.npcInstanceId, npc.id)
    assert.deepEqual([shot.quantity, given.quantity], [6, 4])

    const back = await transferItem(world, given, character, 4)
    await given.refresh()

    assert.equal(back.id, shot.id)
    assert.equal(back.quantity, 10)
    /** Emptied, the other stack reads as gone. */
    assert.deepEqual([given.state, given.quantity], ['gone', 0])
  })

  test('a whole stack moves as it is', async ({ assert }) => {
    const { sessionId, character, location } = await scene()
    const food = await createItem(
      world,
      sessionId,
      { definition: 'food', descriptor: 'a loaf and a sausage', quantity: 2 },
      character
    )

    const left = await transferItem(world, food, location, 2)

    assert.equal(left.id, food.id)
    assert.equal(left.locationInstanceId, location.id)
    assert.equal(left.quantity, 2)
  })

  test('cannot hand over more than is held, nor what is gone', async ({ assert }) => {
    const { sessionId, character, npc } = await scene()
    const food = await createItem(
      world,
      sessionId,
      { definition: 'food', descriptor: null, quantity: 2 },
      character
    )

    await assert.rejects(() => transferItem(world, food, npc, 3), ItemRefusedError)

    await destroyItem(world, food, 2)
    await assert.rejects(() => transferItem(world, food, npc, 1), ItemRefusedError)
  })
})

test.group('Inventory | destroying and equipping', (group) => {
  useTransaction(group)

  test('destroying part of a stack, then the rest', async ({ assert }) => {
    const { sessionId, character } = await scene()
    const shot = await createItem(
      world,
      sessionId,
      { definition: 'lead_shot', descriptor: null, quantity: 3 },
      character
    )

    await destroyItem(world, shot, 1)
    assert.deepEqual([shot.quantity, shot.state], [2, 'carried'])

    await destroyItem(world, shot, 2)
    await shot.refresh()
    /** Never deleted: the row stays, gone, with its last holder. */
    assert.deepEqual([shot.quantity, shot.state], [0, 'gone'])
    assert.equal(shot.characterId, character.id)

    const refilled = await createItem(
      world,
      sessionId,
      { definition: 'lead_shot', descriptor: null, quantity: 5 },
      character
    )
    assert.equal(refilled.id, shot.id)
    assert.deepEqual([refilled.quantity, refilled.state], [5, 'carried'])
  })

  test('the character equips what can be worn or wielded', async ({ assert }) => {
    const { sessionId, character, npc } = await scene()
    const sword = await createItem(world, sessionId, one('rapier'), character)
    const letter = await createItem(world, sessionId, one('letter_to_treville'), character)
    const dagger = await createItem(world, sessionId, one('dagger'), npc)

    await equipItem(world, sword)
    assert.equal(sword.state, 'equipped')

    await unequipItem(sword)
    assert.equal(sword.state, 'carried')

    await assert.rejects(() => equipItem(world, letter), ItemRefusedError)
    await assert.rejects(() => equipItem(world, dagger), ItemRefusedError)
  })
})

test.group('Inventory | where items start, and where they fall', (group) => {
  useTransaction(group)

  test('a unique character comes in with what they hold from the start', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const buckingham = await enterScene(world, sessionId, {
      definition: 'buckingham',
      descriptor: null,
    })
    const studs = await InventoryItem.findByOrFail('handle', 'queens_diamond_studs')

    assert.equal(studs.sessionId, sessionId)
    assert.equal(studs.npcInstanceId, buckingham.id)
  })

  test('a place keeps what it holds from the start, placed on the first visit only', async ({
    assert,
  }) => {
    const sessionId = await createSession(await createUser())
    const character = await createCharacter(sessionId)

    const palace = await visitUniqueLocation(world, sessionId, 'palais_cardinal')
    const seal = await InventoryItem.query()
      .where('sessionId', sessionId)
      .where('handle', 'cardinal_seal')
      .firstOrFail()
    assert.equal(seal.locationInstanceId, palace.id)

    /** Taken away, it is not put back on the next visit. */
    await transferItem(world, seal, { type: 'character', id: character }, 1)
    await visitUniqueLocation(world, sessionId, 'palais_cardinal')

    assert.equal(await countRows('inventory_items', { session_id: sessionId }), 1)
    await seal.refresh()
    assert.equal(seal.characterId, character)
  })

  test('an archetype or a place without items brings nothing', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    await enterScene(world, sessionId, { definition: 'cardinal_guard', descriptor: null })
    await visitUniqueLocation(world, sessionId, 'paris')

    assert.equal(await countRows('inventory_items', { session_id: sessionId }), 0)
  })

  test('what someone held falls to the place where they died', async ({ assert }) => {
    const { sessionId, npc, location } = await scene()
    const warrant = await createItem(world, sessionId, one('richelieu_warrant'), npc)
    await createItem(world, sessionId, { definition: 'food', descriptor: null, quantity: 2 }, npc)
    await createItem(
      world,
      sessionId,
      { definition: 'food', descriptor: null, quantity: 1 },
      location
    )

    await leaveItemsInPlace(world, npc.id, location.id)

    await warrant.refresh()
    assert.equal(warrant.locationInstanceId, location.id)
    const food = await InventoryItem.query()
      .where('locationInstanceId', location.id)
      .where('definitionReference', 'food')
      .firstOrFail()
    assert.equal(food.quantity, 3)
  })
})

test.group('Inventory | the items of the scene', (group) => {
  useTransaction(group)

  test('groups what the character, the people present and the place hold', async ({ assert }) => {
    const { sessionId, character, npc, location } = await scene()
    const absent: Holder = {
      type: 'npc',
      id: await createNpcInstance(sessionId, 'jussac', { status: 'absent' }),
    }
    const elsewhere: Holder = {
      type: 'location',
      id: await createLocationInstance(sessionId, 'louvre'),
    }

    await createItem(
      world,
      sessionId,
      { definition: 'food', descriptor: null, quantity: 2 },
      character
    )
    const sword = await createItem(world, sessionId, one('rapier', 'an old sword'), character)
    await equipItem(world, sword)
    await createItem(world, sessionId, one('richelieu_warrant'), npc)
    await createItem(world, sessionId, one('rope'), location)
    await createItem(world, sessionId, one('dagger'), absent)
    await createItem(world, sessionId, one('pistol'), elsewhere)
    const burnt = await createItem(world, sessionId, one('document'), character)
    await destroyItem(world, burnt, 1)

    const items = await itemsInScene(sessionId, {
      characterId: character.id,
      locationInstanceId: location.id,
    })

    assert.deepEqual(items, {
      character: [
        { handle: null, definition: 'food', descriptor: null, quantity: 2, equipped: false },
        {
          handle: 'rapier_1',
          definition: 'rapier',
          descriptor: 'an old sword',
          quantity: 1,
          equipped: true,
        },
      ],
      npcs: [
        {
          handle: 'rochefort',
          items: [
            {
              handle: 'richelieu_warrant',
              definition: 'richelieu_warrant',
              descriptor: null,
              quantity: 1,
              equipped: false,
            },
          ],
        },
      ],
      location: [
        { handle: 'rope_1', definition: 'rope', descriptor: null, quantity: 1, equipped: false },
      ],
    })
  })

  test('a game not placed anywhere has no place to look in', async ({ assert }) => {
    const { sessionId, character } = await scene()

    const items = await itemsInScene(sessionId, {
      characterId: character.id,
      locationInstanceId: null,
    })

    assert.deepEqual(items, { character: [], npcs: [], location: [] })
  })
})
