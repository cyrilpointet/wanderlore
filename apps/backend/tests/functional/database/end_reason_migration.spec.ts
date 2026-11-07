import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'

import { rollBackPast } from '#tests/helpers/migrations'
import { createSession, createUser } from '#tests/helpers/database'

const MIGRATION = 'database/migrations/1789917380000_add_end_reason_to_sessions'

/**
 * Games already over keep their outcome: a failed one was given up — the
 * only way a game could fail before the end of a game had reasons — and a
 * completed one was won.
 *
 * DDL, so no per-test transaction: rows are removed through their user, and
 * the schema is brought back up whatever happens.
 */
test.group('Migrations | why a game ended', (group) => {
  const users: string[] = []

  group.each.teardown(async () => {
    await db.from('users').whereIn('id', users.splice(0)).delete()
    await testUtils.db().migrate()
  })

  test('a game given up was abandoned, a game completed was won', async ({ assert }) => {
    await rollBackPast(MIGRATION)

    const userId = await createUser()
    users.push(userId)
    const abandoned = await createSession(userId)
    const won = await createSession(userId)
    const playing = await createSession(userId)
    await db
      .from('sessions')
      .where('id', abandoned)
      .update({ status: 'failed', ended_at: new Date() })
    await db.from('sessions').where('id', won).update({ status: 'completed' })

    await testUtils.db().migrate()

    const rows = await db
      .from('sessions')
      .whereIn('id', [abandoned, won, playing])
      .select('id', 'end_reason', 'ended_at')
    const of = (id: string) => rows.find((row) => row.id === id)
    assert.equal(of(abandoned).end_reason, 'abandoned')
    assert.equal(of(won).end_reason, 'victory')
    /** Over without an end date, it takes its last activity. */
    assert.isNotNull(of(won).ended_at)
    assert.isNull(of(playing).end_reason)
    assert.isNull(of(playing).ended_at)
  })
})
