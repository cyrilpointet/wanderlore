import { test } from '@japa/runner'

import {
  PG_CHECK_VIOLATION,
  PG_INVALID_TEXT_REPRESENTATION,
  PG_UNIQUE_VIOLATION,
  createCharacter,
  createInventoryItem,
  createLocationInstance,
  createNpcInstance,
  createResolutionRule,
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

  test('a world holds one rule per action type', async ({ assert }) => {
    await createResolutionRule('three_musketeers', 'melee_combat')

    const error = await expectDbError(() =>
      createResolutionRule('three_musketeers', 'melee_combat', 'swordsmanship')
    )

    /** Two rows would leave resolution picking a skill at random. */
    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('the same action type is fine in another world', async ({ assert }) => {
    await createResolutionRule('three_musketeers', 'melee_combat')

    assert.isString(await createResolutionRule('another_world', 'melee_combat'))
  })

  test('a handle names one place per game', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    await createLocationInstance(sessionId, 'paris')

    const error = await expectDbError(() => createLocationInstance(sessionId, 'paris'))

    /** The model designates a place by its handle alone: two would make it ambiguous. */
    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('the same handle is fine in another game', async ({ assert }) => {
    const userId = await createUser()
    await createLocationInstance(await createSession(userId), 'paris')

    assert.isString(await createLocationInstance(await createSession(userId), 'paris'))
  })

  test('a handle names one person per game', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    await createNpcInstance(sessionId, 'treville')

    const error = await expectDbError(() => createNpcInstance(sessionId, 'treville'))

    /** A unique character met again is made present, never written twice. */
    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('a disposition is a qualitative label, nothing else', async ({ assert }) => {
    const sessionId = await createSession(await createUser())

    const score = await expectDbError(() =>
      createNpcInstance(sessionId, 'jussac', { disposition: '-2' })
    )
    const unknownStatus = await expectDbError(() =>
      createNpcInstance(sessionId, 'jussac', { status: 'wounded' })
    )

    assert.equal(score.code, PG_INVALID_TEXT_REPRESENTATION)
    assert.equal(unknownStatus.code, PG_INVALID_TEXT_REPRESENTATION)
  })

  test('an item has exactly one holder while it exists', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const characterId = await createCharacter(sessionId)
    const npcInstanceId = await createNpcInstance(sessionId)

    const nobody = await expectDbError(() => createInventoryItem(sessionId, {}))
    const twoHolders = await expectDbError(() =>
      createInventoryItem(sessionId, { characterId, npcInstanceId })
    )

    assert.equal(nobody.code, PG_CHECK_VIOLATION)
    assert.equal(twoHolders.code, PG_CHECK_VIOLATION)
    /** Gone, it may keep its last holder or none. */
    assert.isString(
      await createInventoryItem(sessionId, {}, { state: 'gone', quantity: 0, handle: 'rapier_9' })
    )
  })

  test('only the character equips an item', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const npcInstanceId = await createNpcInstance(sessionId)

    const error = await expectDbError(() =>
      createInventoryItem(sessionId, { npcInstanceId }, { state: 'equipped' })
    )

    assert.equal(error.code, PG_CHECK_VIOLATION)
  })

  test('an item that exists counts at least one', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const characterId = await createCharacter(sessionId)

    const empty = await expectDbError(() =>
      createInventoryItem(sessionId, { characterId }, { quantity: 0 })
    )
    const leftover = await expectDbError(() =>
      createInventoryItem(sessionId, { characterId }, { quantity: 2, state: 'gone' })
    )

    assert.equal(empty.code, PG_CHECK_VIOLATION)
    assert.equal(leftover.code, PG_CHECK_VIOLATION)
  })

  test('a handle names one item per game, whoever holds it', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const characterId = await createCharacter(sessionId)
    const locationInstanceId = await createLocationInstance(sessionId)
    await createInventoryItem(sessionId, { characterId })

    const error = await expectDbError(() => createInventoryItem(sessionId, { locationInstanceId }))

    assert.equal(error.code, PG_UNIQUE_VIOLATION)
  })

  test('a holder keeps one stack per definition', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const characterId = await createCharacter(sessionId)
    const npcInstanceId = await createNpcInstance(sessionId)
    const stack = { handle: null, definitionReference: 'lead_shot', quantity: 5 }
    await createInventoryItem(sessionId, { characterId }, stack)

    const error = await expectDbError(() => createInventoryItem(sessionId, { characterId }, stack))

    assert.equal(error.code, PG_UNIQUE_VIOLATION)
    /** The same stack is fine with someone else. */
    assert.isString(await createInventoryItem(sessionId, { npcInstanceId }, stack))
  })

  test('an item state is one of three, nothing else', async ({ assert }) => {
    const sessionId = await createSession(await createUser())
    const characterId = await createCharacter(sessionId)

    const error = await expectDbError(() =>
      createInventoryItem(sessionId, { characterId }, { state: 'broken' })
    )

    assert.equal(error.code, PG_INVALID_TEXT_REPRESENTATION)
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
