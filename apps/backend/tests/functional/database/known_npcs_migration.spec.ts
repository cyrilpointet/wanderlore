import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import { BEFORE_DURABLE_CHARACTERS, migrate } from '#tests/helpers/migrations'

import { createLegacySession, createUser } from '#tests/helpers/database'

const MIGRATION = 'database/migrations/1789917260000_add_known_npcs_to_world_states'

/** Back to just before the migration under test, whatever came after it. */
async function rollBackPastIt() {
  while (await db.from('adonis_schema').where('name', MIGRATION).first()) {
    await migrate({ direction: 'down', step: 1 })
  }
}

/**
 * Games played before names were known keep every unique person they met
 * known: the narrator already named them.
 *
 * DDL, so no per-test transaction: rows are removed through their user, and
 * the schema is brought back up whatever happens.
 */
test.group('Migrations | known people', (group) => {
  const users: string[] = []

  group.each.teardown(async () => {
    await db.from('users').whereIn('id', users.splice(0)).delete()
    await testUtils.db().migrate()
  })

  test('a game under way knows the unique people it met, and nobody else', async ({ assert }) => {
    await rollBackPastIt()

    const userId = await createUser()
    users.push(userId)
    const sessionId = await createLegacySession(userId)
    const quiet = await createLegacySession(userId)
    const now = new Date()
    for (const session of [sessionId, quiet]) {
      await db
        .table('world_states')
        .insert({ session_id: session, created_at: now, updated_at: now })
    }
    const person = (handle: string, definition: string, created: number) => ({
      session_id: sessionId,
      handle,
      definition_reference: definition,
      disposition: 'neutral',
      status: 'absent',
      created_at: new Date(created),
      updated_at: new Date(created),
    })
    await db
      .table('npc_instances')
      .multiInsert([
        person('athos', 'athos', 2),
        person('treville', 'treville', 1),
        person('cardinal_guard_1', 'cardinal_guard', 3),
      ])

    await migrate({ direction: 'up', until: BEFORE_DURABLE_CHARACTERS })

    const known = await db.from('world_states').where('session_id', sessionId).firstOrFail()
    const none = await db.from('world_states').where('session_id', quiet).firstOrFail()
    /** In the order they were met; an archetype's people have no name to know. */
    assert.deepEqual(known.known_npcs, ['treville', 'athos'])
    assert.deepEqual(none.known_npcs, [])
  })

  test('a rollback takes the list away', async ({ assert }) => {
    await rollBackPastIt()

    assert.isFalse(await db.connection().schema.hasColumn('world_states', 'known_npcs'))
  })
})
