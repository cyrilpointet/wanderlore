import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import { loadWorld, loadWorlds } from '#services/game/content/load'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'
import { seedMusketeers } from '#tests/helpers/content'
import { createScenario, useTransaction } from '#tests/helpers/database'

/** A definition row, the defaults of each catalogue filled in. */
function definitionRow(
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
    description: 'Written by a test.',
    created_at: new Date(),
    ...defaults,
    ...values,
  })
}

test.group('Loading a world', (group) => {
  useTransaction(group)

  test('gives the turn the world as the seeder wrote it', async ({ assert }) => {
    const content = await seedMusketeers()

    const world = await loadWorld(content)

    /** Catalogues come sorted by reference: compare them as sets. */
    const byReference = <T extends { reference: string }>(list: T[]) =>
      [...list].sort((a, b) => a.reference.localeCompare(b.reference))

    assert.deepEqual(
      { ...world, npcs: [], locations: [], items: [], actionTypes: [] },
      { ...THREE_MUSKETEERS, npcs: [], locations: [], items: [], actionTypes: [] }
    )
    assert.deepEqual(byReference(world.npcs), byReference(THREE_MUSKETEERS.npcs))
    assert.deepEqual(byReference(world.locations), byReference(THREE_MUSKETEERS.locations))
    assert.deepEqual(byReference(world.items), byReference(THREE_MUSKETEERS.items))
    assert.sameDeepMembers(world.actionTypes, THREE_MUSKETEERS.actionTypes)
  })

  test("a scenario definition replaces the world's, in each catalogue", async ({ assert }) => {
    const { worldId, scenarioId } = await seedMusketeers()

    await definitionRow('npc_definitions', {
      world_id: worldId,
      scenario_id: scenarioId,
      reference: 'athos',
      labels: { en: 'Athos, older' },
    })
    await definitionRow('location_definitions', {
      world_id: worldId,
      scenario_id: scenarioId,
      reference: 'paris',
      labels: { en: 'Paris, under siege' },
    })
    await definitionRow('item_definitions', {
      world_id: worldId,
      scenario_id: scenarioId,
      reference: 'letter_to_treville',
      labels: { en: 'A torn letter' },
    })

    const world = await loadWorld({ worldId, scenarioId })
    const labelOf = (list: { reference: string; label: string }[], reference: string) =>
      list.filter((entry) => entry.reference === reference).map(({ label }) => label)

    assert.deepEqual(labelOf(world.npcs, 'athos'), ['Athos, older'])
    assert.deepEqual(labelOf(world.locations, 'paris'), ['Paris, under siege'])
    assert.deepEqual(labelOf(world.items, 'letter_to_treville'), ['A torn letter'])
  })

  test("a scenario's own definitions add to the world's, for that scenario only", async ({
    assert,
  }) => {
    const { worldId, scenarioId } = await seedMusketeers()
    const otherScenario = await createScenario(worldId)

    await definitionRow('npc_definitions', {
      world_id: worldId,
      scenario_id: scenarioId,
      reference: 'kitty',
      labels: { en: 'Kitty' },
    })

    const worldOf = await loadWorlds([
      { worldId, scenarioId },
      { worldId, scenarioId: otherScenario },
    ])

    assert.include(
      worldOf({ worldId, scenarioId }).npcs.map(({ reference }) => reference),
      'kitty'
    )
    assert.notInclude(
      worldOf({ worldId, scenarioId: otherScenario }).npcs.map(({ reference }) => reference),
      'kitty'
    )
  })

  test('refuses a scenario of another world', async ({ assert }) => {
    const { scenarioId } = await seedMusketeers()
    const [other] = await db
      .table('worlds')
      .insert({
        reference: 'elsewhere',
        labels: { en: 'Elsewhere' },
        narrative_tone: 'Flat.',
        created_at: new Date(),
      })
      .returning('id')

    await assert.rejects(() => loadWorld({ worldId: other.id, scenarioId }))
  })
})
