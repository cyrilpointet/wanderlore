import { test } from '@japa/runner'

import {
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  createSession,
  createTurn,
  createUser,
  createWorldState,
  expectDbError,
  useTransaction,
} from '#tests/helpers/database'

/**
 * The constraints that encode a modelling decision, rather than the ones
 * PostgreSQL would enforce anyway.
 */
test.group('Schema constraints', (group) => {
  useTransaction(group)

  test('a session can only ever have one world state', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    await createWorldState(sessionId)

    const error = await expectDbError(() => createWorldState(sessionId))

    /**
     * The unique constraint is what makes the sessions ↔ world_states relation
     * a genuine 1:1 rather than a convention.
     */
    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('a turn number cannot be reused within the same session', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    await createTurn(sessionId, 1)

    const error = await expectDbError(() => createTurn(sessionId, 1))

    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('the same turn number is fine under a different session', async ({ assert }) => {
    const userId = await createUser()
    const first = await createSession(userId)
    const second = await createSession(userId)

    await createTurn(first, 1)
    const turnId = await createTurn(second, 1)

    /**
     * Proves the uniqueness is composite, not global — each session numbers its
     * own turns from 1.
     */
    assert.isString(turnId)
  })

  test('a failed turn cannot be logged without saying why', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const error = await expectDbError(() => createTurn(sessionId, null, { status: 'failed' }))

    /**
     * Reading the turn back after a lost SSE stream is the only way the player
     * learns why it failed.
     */
    assert.equal(error.code, PG_CHECK_VIOLATION)
  })

  test('only a failed turn carries a failure', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const error = await expectDbError(() =>
      createTurn(sessionId, 1, { failure: { code: 'llm_timeout', message: 'Too slow.' } })
    )

    assert.equal(error.code, PG_CHECK_VIOLATION)
  })

  test('only a completed turn holds a place in the story', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const pendingWithNumber = await expectDbError(() =>
      createTurn(sessionId, 1, { status: 'pending' })
    )
    const completedWithout = await expectDbError(() => createTurn(sessionId, null))

    /**
     * The number is earned by completing: a pending turn holding one could
     * collide with the turn that completes before it.
     */
    assert.equal(pendingWithNumber.code, PG_CHECK_VIOLATION)
    assert.equal(completedWithout.code, PG_CHECK_VIOLATION)
  })

  test('two accounts cannot share an email', async ({ assert }) => {
    await createUser({ email: 'duplicate@wanderlore.test' })

    const error = await expectDbError(() => createUser({ email: 'duplicate@wanderlore.test' }))

    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('the transaction survives an expected violation', async ({ assert }) => {
    const userId = await createUser({ email: 'savepoint@wanderlore.test' })

    await expectDbError(() => createUser({ email: 'savepoint@wanderlore.test' }))

    /**
     * Guards the helper itself: in PostgreSQL a constraint violation aborts the
     * enclosing transaction, so without a savepoint every query after an
     * expected failure would die with "current transaction is aborted".
     */
    const sessionId = await createSession(userId)
    assert.isString(sessionId)
  })
})
