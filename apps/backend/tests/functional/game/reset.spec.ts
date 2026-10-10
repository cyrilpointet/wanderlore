import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import { deleteAllGames } from '#services/game/reset'
import {
  countRows,
  createCharacter,
  createLocationInstance,
  createNpcInstance,
  createResolutionRule,
  createSession,
  createTurn,
  createUser,
  createWorldState,
  useTransaction,
} from '#tests/helpers/database'

async function total(table: string): Promise<number> {
  const [row] = await db.from(table).count('* as total')

  return Number(row.total)
}

test.group('Resetting the games', (group) => {
  useTransaction(group)

  test('removes every game and everything it owns', async ({ assert }) => {
    const userId = await createUser()

    for (let game = 0; game < 2; game++) {
      const sessionId = await createSession(userId)
      await createCharacter(sessionId)
      await createWorldState(sessionId, await createLocationInstance(sessionId))
      await createNpcInstance(sessionId)
      await createTurn(sessionId)
    }

    const removed = await deleteAllGames(db.connection())

    assert.deepEqual(removed, { games: 2, turns: 2 })
    for (const table of [
      'sessions',
      'characters',
      'world_states',
      'turn_log',
      'location_instances',
      'npc_instances',
    ]) {
      assert.equal(await total(table), 0, table)
    }
  })

  test('keeps the accounts and the game content', async ({ assert }) => {
    const userId = await createUser()
    await createSession(userId)
    await createResolutionRule('three_musketeers', 'melee_combat')

    await deleteAllGames(db.connection())

    assert.equal(await countRows('users', { id: userId }), 1)
    assert.equal(await countRows('resolution_rules', { world_reference: 'three_musketeers' }), 1)
  })
})
