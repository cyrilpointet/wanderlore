import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import World from '#models/world'
import { readWorldContent } from '#services/game/content/store'
import type { WorldContent } from '#services/game/content/types'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { seedContent } from '#tests/helpers/content'
import {
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  countRows,
  createResolutionRule,
  createScenario,
  createSession,
  createUser,
  createWorld,
  expectDbError,
  useTransaction,
} from '#tests/helpers/database'

const PG_FOREIGN_KEY_VIOLATION = '23503'

async function musketeersId(): Promise<string> {
  const world = await World.findByOrFail('reference', THREE_MUSKETEERS_CONTENT.reference)
  return world.id
}

/** The content as a read gives it back: definitions and categories sorted by reference. */
function sorted(content: WorldContent): WorldContent {
  const byReference = <T extends { reference: string }>(list: T[]) =>
    [...list].sort((a, b) => a.reference.localeCompare(b.reference))

  return {
    ...content,
    actionTypes: [...content.actionTypes].sort((a, b) => a.actionType.localeCompare(b.actionType)),
    npcs: byReference(content.npcs),
    locations: byReference(content.locations),
    items: byReference(content.items),
    scenarios: byReference(content.scenarios).map((scenario) => ({
      ...scenario,
      npcs: byReference(scenario.npcs),
      locations: byReference(scenario.locations),
      items: byReference(scenario.items),
    })),
  }
}

test.group('Content | seeder', (group) => {
  useTransaction(group)

  test('writes the world as the code declares it, field for field', async ({ assert }) => {
    await seedContent()

    assert.deepEqual(await readWorldContent(await musketeersId()), sorted(THREE_MUSKETEERS_CONTENT))
  })

  test('re-run, duplicates nothing', async ({ assert }) => {
    await seedContent()
    await seedContent()

    const worldId = await musketeersId()

    assert.equal(await countRows('worlds', { reference: THREE_MUSKETEERS_CONTENT.reference }), 1)
    assert.equal(
      await countRows('scenarios', { world_id: worldId }),
      THREE_MUSKETEERS_CONTENT.scenarios.length
    )
    assert.equal(
      await countRows('resolution_rules', { world_id: worldId }),
      THREE_MUSKETEERS_CONTENT.actionTypes.length
    )
    assert.equal(
      await countRows('npc_definitions', { world_id: worldId }),
      THREE_MUSKETEERS_CONTENT.npcs.length
    )
    assert.equal(
      await countRows('location_definitions', { world_id: worldId }),
      THREE_MUSKETEERS_CONTENT.locations.length
    )
    assert.equal(
      await countRows('item_definitions', { world_id: worldId }),
      THREE_MUSKETEERS_CONTENT.items.length
    )
  })

  test('re-run, brings edited rows back in line with the code', async ({ assert }) => {
    await seedContent()
    const worldId = await musketeersId()

    await db
      .from('resolution_rules')
      .where({ world_id: worldId, action_type: 'melee_combat' })
      .update({ description: 'An outdated description.', associated_skill: 'athletics' })
    await db
      .from('npc_definitions')
      .where({ world_id: worldId, reference: 'athos' })
      .update({ description: 'An outdated description.' })
    await db.from('worlds').where({ id: worldId }).update({ narrative_tone: 'An outdated tone.' })

    await seedContent()

    assert.deepEqual(await readWorldContent(worldId), sorted(THREE_MUSKETEERS_CONTENT))
  })

  test('re-run, drops what the code no longer declares', async ({ assert }) => {
    await seedContent()
    const worldId = await musketeersId()

    /** Left in place, they would still be offered to the model. */
    await createResolutionRule(worldId, 'retired_category', 'athletics')
    await db.table('npc_definitions').insert({
      world_id: worldId,
      reference: 'retired_npc',
      labels: { en: 'Retired' },
      description: 'Someone the code no longer has.',
      kind: 'unique',
      default_disposition: 'neutral',
      combat: { skills: {}, hitPointsMax: 5, weapon: null },
      created_at: new Date(),
    })

    await seedContent()

    assert.equal(
      await countRows('resolution_rules', { world_id: worldId, action_type: 'retired_category' }),
      0
    )
    assert.equal(
      await countRows('npc_definitions', { world_id: worldId, reference: 'retired_npc' }),
      0
    )
  })

  test("leaves another world's content alone", async ({ assert }) => {
    const otherWorld = await createWorld('another_world')
    await createResolutionRule(otherWorld, 'melee_combat', 'brawling')

    await seedContent()

    assert.equal(await countRows('worlds', { id: otherWorld }), 1)
    assert.equal(await countRows('resolution_rules', { world_id: otherWorld }), 1)
  })

  test('publishes the scenario of the demo game', async ({ assert }) => {
    await seedContent()

    const scenario = await db
      .from('scenarios')
      .where({ world_id: await musketeersId(), reference: 'a_gascon_in_paris' })
      .firstOrFail()

    assert.equal(scenario.status, 'published')
    assert.equal(scenario.pregenerated_character.name, "d'Artagnan")
    assert.equal(scenario.initial_state.location, 'meung_sur_loire')
  })
})

/** Inserts a definition straight through the query builder, defaults filled in. */
async function insertDefinition(
  table: 'npc_definitions' | 'location_definitions' | 'item_definitions',
  values: Record<string, unknown>
) {
  const defaults = {
    npc_definitions: {
      kind: 'unique',
      default_disposition: 'neutral',
      combat: { skills: {}, hitPointsMax: 5, weapon: null },
    },
    location_definitions: { kind: 'unique' },
    item_definitions: { kind: 'unique' },
  }[table]

  return db.table(table).insert({
    reference: 'someone',
    labels: { en: 'Someone' },
    description: 'A definition written by a test.',
    created_at: new Date(),
    ...defaults,
    ...values,
  })
}

test.group('Content | constraints', (group) => {
  useTransaction(group)

  test('a world reference is unique', async ({ assert }) => {
    await createWorld('twice')

    const error = await expectDbError(() => createWorld('twice'))

    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('a scenario reference is unique in its world only', async ({ assert }) => {
    const worldId = await createWorld()
    await createScenario(worldId, { reference: 'opening' })

    const error = await expectDbError(() => createScenario(worldId, { reference: 'opening' }))

    assert.equal(error.code, PG_UNIQUE_VIOLATION)
    assert.isString(await createScenario(await createWorld(), { reference: 'opening' }))
  })

  test('a reference is unique among the world definitions', async ({ assert }) => {
    const worldId = await createWorld()

    for (const table of ['npc_definitions', 'location_definitions', 'item_definitions'] as const) {
      await insertDefinition(table, { world_id: worldId })

      const error = await expectDbError(() => insertDefinition(table, { world_id: worldId }))

      assert.equal(error.code, PG_UNIQUE_VIOLATION, table)
    }
  })

  test('a scenario definition may share the reference of a world one', async ({ assert }) => {
    const worldId = await createWorld()
    const scenarioId = await createScenario(worldId)

    for (const table of ['npc_definitions', 'location_definitions', 'item_definitions'] as const) {
      await insertDefinition(table, { world_id: worldId })
      await insertDefinition(table, { world_id: worldId, scenario_id: scenarioId })

      /** Overriding is once per scenario: twice would leave the game picking one. */
      const error = await expectDbError(() =>
        insertDefinition(table, { world_id: worldId, scenario_id: scenarioId })
      )

      assert.equal(error.code, PG_UNIQUE_VIOLATION, table)
    }
  })

  test("a definition cannot hang off another world's scenario", async ({ assert }) => {
    const worldId = await createWorld()
    const foreignScenario = await createScenario(await createWorld())

    const error = await expectDbError(() =>
      insertDefinition('npc_definitions', { world_id: worldId, scenario_id: foreignScenario })
    )

    assert.equal(error.code, PG_FOREIGN_KEY_VIOLATION)
  })

  test('a game cannot be played from another world’s scenario', async ({ assert }) => {
    const userId = await createUser()
    const worldId = await createWorld()
    const foreignScenario = await createScenario(await createWorld())

    const error = await expectDbError(() =>
      createSession(userId, { worldId, scenarioId: foreignScenario })
    )

    assert.equal(error.code, PG_FOREIGN_KEY_VIOLATION)
  })

  test('content a game was played with cannot be deleted', async ({ assert }) => {
    const worldId = await createWorld()
    const scenarioId = await createScenario(worldId)
    await createSession(await createUser(), { worldId, scenarioId })

    const error = await expectDbError(() => db.from('scenarios').where('id', scenarioId).delete())

    assert.equal(error.code, PG_FOREIGN_KEY_VIOLATION)
  })

  test('only an archetype may be generic, stackable or without a holder', async ({ assert }) => {
    const worldId = await createWorld()

    const genericUniqueNpc = await expectDbError(() =>
      insertDefinition('npc_definitions', { world_id: worldId, generic: true })
    )
    const stackableUniqueItem = await expectDbError(() =>
      insertDefinition('item_definitions', { world_id: worldId, stackable: true })
    )
    const heldArchetype = await expectDbError(() =>
      insertDefinition('item_definitions', {
        world_id: worldId,
        kind: 'archetype',
        initial_holder: { holder: 'npc', reference: 'someone' },
      })
    )
    const parentedArchetype = await expectDbError(() =>
      insertDefinition('location_definitions', {
        world_id: worldId,
        kind: 'archetype',
        parent: 'paris',
      })
    )

    for (const error of [genericUniqueNpc, stackableUniqueItem, heldArchetype, parentedArchetype]) {
      assert.equal(error.code, PG_CHECK_VIOLATION)
    }
  })
})
