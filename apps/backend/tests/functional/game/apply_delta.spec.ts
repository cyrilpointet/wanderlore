import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Character from '#models/character'
import NpcInstance from '#models/npc_instance'
import WorldState from '#models/world_state'
import LocationInstance from '#models/location_instance'
import InventoryItem from '#models/inventory_item'
import { createItem } from '#services/game/inventory'
import { applyDelta } from '#services/game/apply_delta'
import { ContentLabels } from '#services/game/content_labels'
import { visitUniqueLocation } from '#services/game/locations'
import { enterScene } from '#services/game/npcs'
import type { TurnEffects } from '#services/game/prompts/types'
import { THREE_MUSKETEERS, GASCON } from '#tests/helpers/worlds'
import { countRows, createSession, createUser, useTransaction } from '#tests/helpers/database'

/** A delta that changes nothing: a spec names only what it is about. */
function delta(overrides: Partial<TurnEffects> = {}): TurnEffects {
  return {
    movement: null,
    npcs_entered: [],
    npcs_left: [],
    npcs_following: [],
    npc_names: [],
    npc_relations: [],
    scenario_flags: [],
    hit_points_delta: 0,
    items_created: [],
    items_transferred: [],
    items_destroyed: [],
    items_equipped: [],
    items_unequipped: [],
    ...overrides,
  }
}

/** A game standing in Paris. */
async function arrangeScene() {
  const sessionId = await createSession(await createUser())
  const character = await Character.create({
    sessionId,
    name: "d'Artagnan",
    characteristics: GASCON,
    skills: {},
    resources: {},
    progression: {},
    hitPoints: 10,
    hitPointsMax: 10,
  })
  const paris = await visitUniqueLocation(THREE_MUSKETEERS, sessionId, 'paris')
  await WorldState.create({
    sessionId,
    currentLocationId: paris.id,
    activeQuests: [],
    narrativeFlags: {},
  })

  return { sessionId, character, paris }
}

/** Applies a delta the way a turn does: inside a transaction, on the state as loaded. */
async function apply(scene: { sessionId: string; character: Character }, effects: TurnEffects) {
  const worldState = await WorldState.query()
    .where('sessionId', scene.sessionId)
    .preload('currentLocation')
    .firstOrFail()

  return db.transaction((trx) =>
    applyDelta(
      {
        world: THREE_MUSKETEERS,
        sessionId: scene.sessionId,
        character: scene.character,
        worldState,
      },
      effects,
      trx
    )
  )
}

async function whereTheGameStands(sessionId: string): Promise<LocationInstance> {
  const worldState = await WorldState.query()
    .where('sessionId', sessionId)
    .preload('currentLocation')
    .firstOrFail()

  return worldState.currentLocation
}

async function statusOf(sessionId: string, handle: string) {
  const npc = await NpcInstance.query().where({ sessionId, handle }).firstOrFail()

  return npc.status
}

test.group('Applying a delta | places', (group) => {
  useTransaction(group)

  test('a named place visited again keeps its instance', async ({ assert }) => {
    const scene = await arrangeScene()

    await apply(scene, delta({ movement: { location: 'louvre' } }))
    await apply(scene, delta({ movement: { location: 'paris' } }))

    const current = await whereTheGameStands(scene.sessionId)
    const places = await LocationInstance.query().where('sessionId', scene.sessionId)

    assert.equal(current.id, scene.paris.id)
    assert.lengthOf(places, 2)
  })

  test('a place off the map becomes an instance of its archetype', async ({ assert }) => {
    const scene = await arrangeScene()

    const applied = await apply(
      scene,
      delta({
        movement: {
          definition: 'town',
          parent: 'france',
          descriptor: 'a river town with a stone bridge',
          name: 'Orléans',
        },
      })
    )

    const current = await whereTheGameStands(scene.sessionId)

    assert.equal(current.handle, 'town_1')
    assert.equal(current.name, 'Orléans')
    assert.equal(current.parentReference, 'france')
    /** Logged in references, labelled when read: the journal says where the character went. */
    assert.deepEqual(new ContentLabels(THREE_MUSKETEERS).location(applied.movement!), {
      reference: 'town_1',
      label: 'Orléans',
    })
  })

  test('a move to where the character stands is no move', async ({ assert }) => {
    const scene = await arrangeScene()
    await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'treville',
      descriptor: null,
    })

    const applied = await apply(scene, delta({ movement: { location: 'paris' } }))

    assert.isNull(applied.movement)
    /** Nobody was left behind by a move that did not happen. */
    assert.equal(await statusOf(scene.sessionId, 'treville'), 'present')
  })
})

test.group('Applying a delta | people', (group) => {
  useTransaction(group)

  test('changing place leaves behind everyone but those who follow', async ({ assert }) => {
    const scene = await arrangeScene()
    await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'planchet',
      descriptor: null,
    })
    await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'commoner',
      descriptor: 'a water carrier',
    })

    await apply(scene, delta({ movement: { location: 'louvre' }, npcs_following: ['planchet'] }))

    assert.equal(await statusOf(scene.sessionId, 'planchet'), 'present')
    assert.equal(await statusOf(scene.sessionId, 'commoner_1'), 'absent')
  })

  test('someone entering at the new place is not left behind by the move', async ({ assert }) => {
    const scene = await arrangeScene()

    const applied = await apply(
      scene,
      delta({
        movement: { location: 'louvre' },
        npcs_entered: [
          { definition: 'royal_guard', descriptor: 'a guard at the gate', name: null },
        ],
      })
    )

    assert.deepEqual(applied.npcs_entered, ['royal_guard_1'])
    assert.equal(await statusOf(scene.sessionId, 'royal_guard_1'), 'present')
  })

  test('someone who gives their name as they come in keeps it', async ({ assert }) => {
    const scene = await arrangeScene()

    await apply(
      scene,
      delta({
        npcs_entered: [
          { definition: 'merchant', descriptor: 'a stout innkeeper', name: 'Jean Dubois' },
        ],
      })
    )

    const innkeeper = await NpcInstance.query()
      .where({ sessionId: scene.sessionId, handle: 'merchant_1' })
      .firstOrFail()

    assert.equal(innkeeper.name, 'Jean Dubois')
    assert.equal(innkeeper.descriptor, 'a stout innkeeper')
  })

  test('an archetype entering twice is two people', async ({ assert }) => {
    const scene = await arrangeScene()

    const applied = await apply(
      scene,
      delta({
        npcs_entered: [
          { definition: 'cardinal_guard', descriptor: 'a guard with a scar', name: null },
          { definition: 'cardinal_guard', descriptor: 'a young guard, visibly bored', name: null },
        ],
      })
    )

    assert.deepEqual(applied.npcs_entered, ['cardinal_guard_1', 'cardinal_guard_2'])
  })

  test('a dead character cannot walk back in, and the rest still applies', async ({ assert }) => {
    const scene = await arrangeScene()
    const jussac = await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'jussac',
      descriptor: null,
    })
    jussac.status = 'dead'
    await jussac.save()

    const applied = await apply(
      scene,
      delta({
        npcs_entered: [{ definition: 'jussac', descriptor: null, name: null }],
        scenario_flags: ['ghost_seen'],
      })
    )

    assert.deepEqual(applied.npcs_entered, [])
    assert.equal(await statusOf(scene.sessionId, 'jussac'), 'dead')
    assert.deepEqual(applied.scenario_flags, ['ghost_seen'])
  })

  test('someone who leaves goes absent, and is never deleted', async ({ assert }) => {
    const scene = await arrangeScene()
    await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'treville',
      descriptor: null,
    })

    await apply(scene, delta({ npcs_left: ['treville'] }))

    assert.equal(await statusOf(scene.sessionId, 'treville'), 'absent')
  })

  test('names learnt and dispositions are set on the instances named', async ({ assert }) => {
    const scene = await arrangeScene()
    await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'royal_guard',
      descriptor: 'a young guard',
    })

    await apply(
      scene,
      delta({
        npc_names: [{ handle: 'royal_guard_1', name: 'Jacques' }],
        npc_relations: [{ handle: 'royal_guard_1', disposition: 'friendly' }],
      })
    )

    const guard = await NpcInstance.query()
      .where({ sessionId: scene.sessionId, handle: 'royal_guard_1' })
      .firstOrFail()

    assert.equal(guard.name, 'Jacques')
    /** The disposition proposed is the new one, set as is. */
    assert.equal(guard.disposition, 'friendly')
  })
})

test.group('Applying a delta | the character', (group) => {
  useTransaction(group)

  test('hit points stop at zero, and the log says what was lost', async ({ assert }) => {
    const scene = await arrangeScene()
    scene.character.hitPoints = 2
    await scene.character.save()

    const applied = await apply(scene, delta({ hit_points_delta: -5 }))

    assert.equal(applied.hit_points_delta, -2)
    await scene.character.refresh()
    assert.equal(scene.character.hitPoints, 0)
  })
})

/** Where an item stands now: its holder, quantity and state. */
async function itemOf(sessionId: string, handle: string) {
  return InventoryItem.query().where({ sessionId, handle }).firstOrFail()
}

test.group('Applying a delta | items', (group) => {
  useTransaction(group)

  const character = { holder: 'character' as const }
  const location = { holder: 'location' as const }

  test('creates items, a copy numbered by the backend and a stack added up', async ({ assert }) => {
    const scene = await arrangeScene()
    const stool = {
      definition: 'improvised_weapon',
      descriptor: 'a three-legged stool',
      quantity: 1,
      holder: character,
      equipped: true,
    }
    const food = { ...stool, definition: 'food', descriptor: null, quantity: 2, equipped: false }

    await apply(scene, delta({ items_created: [food] }))
    const applied = await apply(scene, delta({ items_created: [stool, food] }))

    const made = await itemOf(scene.sessionId, 'improvised_weapon_1')
    const stack = await InventoryItem.query()
      .where({ sessionId: scene.sessionId, definitionReference: 'food' })
      .firstOrFail()
    assert.deepEqual([made.state, made.descriptor], ['equipped', 'a three-legged stool'])
    assert.equal(stack.quantity, 4)
    assert.deepEqual(applied.items.created, [
      {
        item: 'improvised_weapon_1',
        definition: 'improvised_weapon',
        quantity: 1,
        holder: character,
      },
      { item: 'food', definition: 'food', quantity: 2, holder: character },
    ])
    assert.deepEqual(applied.items.equipped, [
      { item: 'improvised_weapon_1', definition: 'improvised_weapon' },
    ])
  })

  test('someone takes the letter, leaves with it, and comes back with it', async ({ assert }) => {
    const scene = await arrangeScene()
    await createItem(
      THREE_MUSKETEERS,
      scene.sessionId,
      { definition: 'letter_to_treville', descriptor: null, quantity: 1 },
      { type: 'character', id: scene.character.id }
    )
    await enterScene(THREE_MUSKETEERS, scene.sessionId, {
      definition: 'rochefort',
      descriptor: null,
    })
    const rochefort = { holder: 'npc' as const, handle: 'rochefort' }

    const applied = await apply(
      scene,
      delta({
        items_transferred: [
          { item: 'letter_to_treville', from: character, to: rochefort, quantity: 1 },
        ],
      })
    )
    await apply(scene, delta({ npcs_left: ['rochefort'] }))
    await apply(
      scene,
      delta({ npcs_entered: [{ definition: 'rochefort', descriptor: null, name: null }] })
    )

    const letter = await itemOf(scene.sessionId, 'letter_to_treville')
    const instance = await NpcInstance.query()
      .where({ sessionId: scene.sessionId, handle: 'rochefort' })
      .firstOrFail()
    assert.equal(letter.npcInstanceId, instance.id)
    assert.isNull(letter.characterId)
    /** Logged with what labels the holder later, without reading the instance back. */
    assert.deepEqual(applied.items.transferred[0].to, {
      holder: 'npc',
      handle: 'rochefort',
      definitionReference: 'rochefort',
      name: null,
    })
  })

  test('hidden in the place the turn began in, found again on the way back', async ({ assert }) => {
    const scene = await arrangeScene()
    await createItem(
      THREE_MUSKETEERS,
      scene.sessionId,
      { definition: 'letter_to_treville', descriptor: null, quantity: 1 },
      { type: 'character', id: scene.character.id }
    )

    /** Hidden in Paris on the way out: the location is where the turn began. */
    await apply(
      scene,
      delta({
        movement: { location: 'louvre' },
        items_transferred: [
          { item: 'letter_to_treville', from: character, to: location, quantity: 1 },
        ],
      })
    )
    await apply(scene, delta({ movement: { location: 'paris' } }))
    await apply(
      scene,
      delta({
        items_transferred: [
          { item: 'letter_to_treville', from: location, to: character, quantity: 1 },
        ],
      })
    )

    const letter = await itemOf(scene.sessionId, 'letter_to_treville')
    assert.equal(letter.characterId, scene.character.id)
    assert.equal(await countRows('inventory_items', { session_id: scene.sessionId }), 1)
  })

  test('a unique character entering brings what they hold from the start', async ({ assert }) => {
    const scene = await arrangeScene()

    await apply(
      scene,
      delta({ npcs_entered: [{ definition: 'buckingham', descriptor: null, name: null }] })
    )

    const studs = await itemOf(scene.sessionId, 'queens_diamond_studs')
    assert.isNotNull(studs.npcInstanceId)
  })

  test('uses up part of a stack, then the rest', async ({ assert }) => {
    const scene = await arrangeScene()
    await createItem(
      THREE_MUSKETEERS,
      scene.sessionId,
      { definition: 'lead_shot', descriptor: null, quantity: 3 },
      { type: 'character', id: scene.character.id }
    )
    const fire = (quantity: number) =>
      delta({ items_destroyed: [{ item: 'lead_shot', holder: character, quantity }] })

    await apply(scene, fire(1))
    const shot = await InventoryItem.query()
      .where({ sessionId: scene.sessionId, definitionReference: 'lead_shot' })
      .firstOrFail()
    assert.equal(shot.quantity, 2)

    await apply(scene, fire(2))
    await shot.refresh()
    assert.deepEqual([shot.quantity, shot.state], [0, 'gone'])
  })

  test('draws and puts away a weapon', async ({ assert }) => {
    const scene = await arrangeScene()
    await createItem(
      THREE_MUSKETEERS,
      scene.sessionId,
      { definition: 'rapier', descriptor: null, quantity: 1 },
      { type: 'character', id: scene.character.id }
    )

    await apply(scene, delta({ items_equipped: ['rapier_1'] }))
    const sword = await itemOf(scene.sessionId, 'rapier_1')
    assert.equal(sword.state, 'equipped')

    const applied = await apply(scene, delta({ items_unequipped: ['rapier_1'] }))
    await sword.refresh()
    assert.equal(sword.state, 'carried')
    assert.deepEqual(applied.items.unequipped, [{ item: 'rapier_1', definition: 'rapier' }])
  })

  test('nothing of it stays when the turn fails after applying it', async ({ assert }) => {
    const scene = await arrangeScene()
    const worldState = await WorldState.query()
      .where('sessionId', scene.sessionId)
      .preload('currentLocation')
      .firstOrFail()

    await db
      .transaction(async (trx) => {
        await applyDelta(
          {
            world: THREE_MUSKETEERS,
            sessionId: scene.sessionId,
            character: scene.character,
            worldState,
          },
          delta({
            items_created: [
              {
                definition: 'rope',
                descriptor: null,
                quantity: 1,
                holder: character,
                equipped: false,
              },
            ],
          }),
          trx
        )
        throw new Error('The turn was expired while it was being applied.')
      })
      .catch(() => {})

    assert.equal(await countRows('inventory_items', { session_id: scene.sessionId }), 0)
  })
})
