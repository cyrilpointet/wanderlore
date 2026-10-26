import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import PassageState from '#models/passage_state'
import {
  UnknownPassageError,
  discoverPassage,
  passageStates,
  unlockPassage,
} from '#services/game/passages'
import { HOUSE_PLACES } from '#tests/helpers/places'
import { countRows, createSession, createUser, useTransaction } from '#tests/helpers/database'

const HIDDEN = { from: 'house_study', to: 'house_cellar' }
const LOCKED = { from: 'house_hall', to: 'house_study' }

async function game(): Promise<string> {
  return createSession(await createUser())
}

test.group('Passages | what a game learns', (group) => {
  useTransaction(group)

  test('a game starts knowing nothing of its passages', async ({ assert }) => {
    const states = await passageStates(await game())

    assert.equal(states.discovered.size, 0)
    assert.equal(states.unlocked.size, 0)
  })

  test('a passage found, a passage opened', async ({ assert }) => {
    const sessionId = await game()

    await discoverPassage(HOUSE_PLACES, sessionId, HIDDEN)
    await unlockPassage(HOUSE_PLACES, sessionId, LOCKED)

    const states = await passageStates(sessionId)
    assert.deepEqual([...states.discovered], ['house_study>house_cellar'])
    assert.deepEqual([...states.unlocked], ['house_hall>house_study'])
  })

  test('found and opened, a passage keeps one row', async ({ assert }) => {
    const sessionId = await game()

    await discoverPassage(HOUSE_PLACES, sessionId, LOCKED)
    await unlockPassage(HOUSE_PLACES, sessionId, LOCKED)

    assert.equal(await countRows('passage_states', { session_id: sessionId }), 1)
  })

  test('found again, it keeps the moment it was first found', async ({ assert }) => {
    const sessionId = await game()

    await discoverPassage(HOUSE_PLACES, sessionId, HIDDEN)
    const first = await PassageState.findByOrFail('sessionId', sessionId)
    await discoverPassage(HOUSE_PLACES, sessionId, HIDDEN)
    const again = await PassageState.findByOrFail('sessionId', sessionId)

    assert.equal(again.discoveredAt!.toMillis(), first.discoveredAt!.toMillis())
    assert.equal(await countRows('passage_states', { session_id: sessionId }), 1)
  })

  test('a passage the world does not have is refused', async ({ assert }) => {
    const sessionId = await game()

    await assert.rejects(
      () => unlockPassage(HOUSE_PLACES, sessionId, { from: 'house_study', to: 'house_hall' }),
      UnknownPassageError
    )
    assert.equal(await countRows('passage_states', { session_id: sessionId }), 0)
  })

  test('each game learns its own', async ({ assert }) => {
    const mine = await game()
    const theirs = await game()

    await discoverPassage(HOUSE_PLACES, mine, HIDDEN)

    const { discovered } = await passageStates(theirs)
    assert.equal(discovered.size, 0)
  })

  test('they go with their game', async ({ assert }) => {
    const sessionId = await game()
    await discoverPassage(HOUSE_PLACES, sessionId, HIDDEN)

    await db.from('sessions').where('id', sessionId).delete()

    assert.equal(await countRows('passage_states', { session_id: sessionId }), 0)
  })
})
