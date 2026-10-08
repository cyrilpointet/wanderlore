import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import Character from '#models/character'
import NpcInstance from '#models/npc_instance'
import WorldState from '#models/world_state'
import LocationInstance from '#models/location_instance'
import { applyDelta } from '#services/game/apply_delta'
import { ContentLabels } from '#services/game/content_labels'
import { visitUniqueLocation } from '#services/game/locations'
import { enterScene } from '#services/game/npcs'
import type { TurnEffects } from '#services/game/prompts/types'
import { THREE_MUSKETEERS } from '#services/game/world'
import { createSession, createUser, useTransaction } from '#tests/helpers/database'

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
    ...overrides,
  }
}

/** A game standing in Paris. */
async function arrangeScene() {
  const sessionId = await createSession(await createUser())
  const character = await Character.create({
    sessionId,
    name: "d'Artagnan",
    attributes: {},
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
    worldObjects: [],
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
        npcs_entered: [{ definition: 'royal_guard', descriptor: 'a guard at the gate' }],
      })
    )

    assert.deepEqual(applied.npcs_entered, ['royal_guard_1'])
    assert.equal(await statusOf(scene.sessionId, 'royal_guard_1'), 'present')
  })

  test('an archetype entering twice is two people', async ({ assert }) => {
    const scene = await arrangeScene()

    const applied = await apply(
      scene,
      delta({
        npcs_entered: [
          { definition: 'cardinal_guard', descriptor: 'a guard with a scar' },
          { definition: 'cardinal_guard', descriptor: 'a young guard, visibly bored' },
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
        npcs_entered: [{ definition: 'jussac', descriptor: null }],
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
