import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { MigrationRunner } from '@adonisjs/lucid/migration'
import testUtils from '@adonisjs/core/services/test_utils'

const MIGRATION = 'database/migrations/1789917280000_move_world_rules_and_ambiance_to_lore'

/**
 * Driven through the runner itself rather than through `node ace`: the
 * commands regenerate `database/schema.ts`, the runner does not.
 */
async function migrate(options: { direction: 'up' } | { direction: 'down'; step: number }) {
  const runner = new MigrationRunner(db, app, options)

  await runner.run()

  if (runner.error) {
    throw runner.error
  }
}

/** Back to just before the migration under test, whatever came after it. */
async function rollBackPastIt() {
  while (await db.from('adonis_schema').where('name', MIGRATION).first()) {
    await migrate({ direction: 'down', step: 1 })
  }
}

async function insertWorld(reference: string, rules: string[], ambiance: string[]) {
  const now = new Date()
  const [row] = await db
    .table('worlds')
    .insert({
      reference,
      labels: { en: reference },
      narrative_tone: 'A world written by a test.',
      rules: JSON.stringify(rules),
      ambiance: JSON.stringify(ambiance),
      created_at: now,
      updated_at: now,
    })
    .returning('id')

  return row.id as string
}

/**
 * A world's rules and ambiance become fragments without tags, numbered in the
 * order they were written, and come back as lists on the way down.
 *
 * DDL, so no per-test transaction: the worlds are removed by hand, and the
 * schema is brought back up whatever happens.
 */
test.group('Migrations | rules and ambiance into lore', (group) => {
  const worlds: string[] = []

  group.each.teardown(async () => {
    await db.from('worlds').whereIn('id', worlds.splice(0)).delete()
    await testUtils.db().migrate()
  })

  test('each sentence becomes a fragment sent with every turn', async ({ assert }) => {
    await rollBackPastIt()
    const worldId = await insertWorld(
      'moved_world',
      ['There is no magic.', 'Duels are forbidden.'],
      ['Fog on the river.']
    )
    worlds.push(worldId)

    await migrate({ direction: 'up' })

    const fragments = await db
      .from('lore_fragments')
      .where('world_id', worldId)
      .orderBy('reference')
      .select('reference', 'kind', 'content', 'tags', 'secret', 'scenario_id')
    assert.deepEqual(fragments, [
      {
        reference: 'ambiance_01',
        kind: 'ambiance',
        content: 'Fog on the river.',
        tags: [],
        secret: false,
        scenario_id: null,
      },
      {
        reference: 'rule_01',
        kind: 'rule',
        content: 'There is no magic.',
        tags: [],
        secret: false,
        scenario_id: null,
      },
      {
        reference: 'rule_02',
        kind: 'rule',
        content: 'Duels are forbidden.',
        tags: [],
        secret: false,
        scenario_id: null,
      },
    ])
    assert.isFalse(await db.connection().schema.hasColumn('worlds', 'rules'))
    assert.isFalse(await db.connection().schema.hasColumn('worlds', 'ambiance'))
  })

  test('a rollback gives the lists back, and leaves any other fragment alone', async ({
    assert,
  }) => {
    await rollBackPastIt()
    const worldId = await insertWorld('round_trip', ['There is no magic.'], ['Fog.'])
    worlds.push(worldId)
    await migrate({ direction: 'up' })
    const now = new Date()
    await db.table('lore_fragments').insert({
      world_id: worldId,
      reference: 'the_mill',
      kind: 'fact',
      content: 'The Huguenots hold the mill.',
      tags: ['the_mill'],
      created_at: now,
      updated_at: now,
    })

    await rollBackPastIt()

    const world = await db.from('worlds').where('id', worldId).firstOrFail()
    assert.deepEqual(world.rules, ['There is no magic.'])
    assert.deepEqual(world.ambiance, ['Fog.'])
    const left = await db.from('lore_fragments').where('world_id', worldId).select('reference')
    assert.deepEqual(left, [{ reference: 'the_mill' }])
  })
})
