import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import {
  countRows,
  createCharacter,
  createSession,
  createTurn,
  createUser,
  createWorldState,
  useTransaction,
} from '#tests/helpers/database'

/**
 * Deleting a row must not leave orphans behind. The cascades are declared in the
 * migrations and nothing else guards them — a future migration that recreates a
 * foreign key without `onDelete('CASCADE')` would silently start leaking rows.
 */
test.group('Cascading deletes', (group) => {
  useTransaction(group)

  test('deleting a session removes everything that belongs to it', async ({ assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)
    await createCharacter(sessionId)
    await createWorldState(sessionId)
    await createTurn(sessionId)

    await db.from('sessions').where({ id: sessionId }).delete()

    assert.equal(await countRows('characters', { session_id: sessionId }), 0)
    assert.equal(await countRows('world_states', { session_id: sessionId }), 0)
    assert.equal(await countRows('turn_log', { session_id: sessionId }), 0)
  })

  test('deleting a user removes their sessions and everything below', async ({ assert }) => {
    const userId = await createUser()
    const sessionId = await createSession(userId)
    await createCharacter(sessionId)
    await createWorldState(sessionId)
    await createTurn(sessionId)

    await db.from('users').where({ id: userId }).delete()

    /**
     * The two-level cascade is the one worth pinning: the session row is an
     * intermediate, so a missing cascade further down would not show up until
     * data had already been orphaned.
     */
    assert.equal(await countRows('sessions', { user_id: userId }), 0)
    assert.equal(await countRows('characters', { session_id: sessionId }), 0)
    assert.equal(await countRows('world_states', { session_id: sessionId }), 0)
    assert.equal(await countRows('turn_log', { session_id: sessionId }), 0)
  })

  test('deleting a user revokes their access tokens', async ({ assert }) => {
    const userId = await createUser()
    await db.table('auth_access_tokens').insert({
      tokenable_id: userId,
      type: 'auth_token',
      name: null,
      hash: 'hash',
      abilities: '["*"]',
      created_at: new Date(),
      updated_at: new Date(),
    })

    await db.from('users').where({ id: userId }).delete()

    assert.equal(await countRows('auth_access_tokens', { tokenable_id: userId }), 0)
  })

  test('deleting a session leaves other sessions untouched', async ({ assert }) => {
    const userId = await createUser()
    const deleted = await createSession(userId)
    const kept = await createSession(userId)
    await createCharacter(kept)

    await db.from('sessions').where({ id: deleted }).delete()

    assert.equal(await countRows('sessions', { id: kept }), 1)
    assert.equal(await countRows('characters', { session_id: kept }), 1)
  })
})
