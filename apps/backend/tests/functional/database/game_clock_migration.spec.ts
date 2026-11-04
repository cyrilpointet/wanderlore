import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import { BEFORE_DURABLE_CHARACTERS, migrate } from '#tests/helpers/migrations'

import { createLegacySession, createUser } from '#tests/helpers/database'

const MIGRATION = 'database/migrations/1789917220000_add_game_clock'

/**
 * Back to just before the migration under test, whatever came after it. One
 * file at a time: the runner only counts `step` within the latest batch.
 */
async function rollBackPastIt() {
  while (await db.from('adonis_schema').where('name', MIGRATION).first()) {
    await migrate({ direction: 'down', step: 1 })
  }
}

/**
 * Games played before the clock existed start it at the opening of their
 * scenario.
 *
 * DDL, so no per-test transaction: rows are removed through their user, and
 * the schema is brought back up whatever happens.
 */
test.group('Migrations | game clock', (group) => {
  const users: string[] = []

  group.each.teardown(async () => {
    await db.from('users').whereIn('id', users.splice(0)).delete()
    await testUtils.db().migrate()
  })

  test('a game under way opens its clock at its scenario’s time', async ({ assert }) => {
    await rollBackPastIt()

    const userId = await createUser()
    users.push(userId)
    const sessionId = await createLegacySession(userId)
    const now = new Date()
    await db
      .table('world_states')
      .insert({ session_id: sessionId, created_at: now, updated_at: now })

    await migrate({ direction: 'up', until: BEFORE_DURABLE_CHARACTERS })

    const state = await db.from('world_states').where('session_id', sessionId).firstOrFail()
    const session = await db.from('sessions').where('id', sessionId).firstOrFail()
    const scenario = await db.from('scenarios').where('id', session.scenario_id).firstOrFail()

    /** A scenario written before the clock opens at 08:00, with no date. */
    assert.equal(scenario.start_time, '08:00:00')
    assert.isNull(scenario.start_date)
    assert.equal(state.game_time, 8 * 3600)
    assert.isNull(state.start_date)
  })

  test('a rollback takes the clock away', async ({ assert }) => {
    await rollBackPastIt()

    const columns = await db.connection().schema.hasColumn('world_states', 'game_time')
    const logged = await db.connection().schema.hasColumn('turn_log', 'game_time_before')
    const started = await db.connection().schema.hasColumn('scenarios', 'start_time')

    assert.isFalse(columns)
    assert.isFalse(logged)
    assert.isFalse(started)
  })
})
