import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import { deleteAllGames } from '#services/game/reset'
import {
  countRows,
  createCharacter,
  createLocationInstance,
  createNpcInstance,
  createResolutionRule,
  createScenario,
  createWorld,
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
    const worldId = await createWorld()
    const scenarioId = await createScenario(worldId)
    await createSession(userId, { worldId, scenarioId })
    await createResolutionRule(worldId, 'melee_combat')

    await deleteAllGames(db.connection())

    assert.equal(await countRows('users', { id: userId }), 1)
    assert.equal(await countRows('worlds', { id: worldId }), 1)
    assert.equal(await countRows('scenarios', { id: scenarioId }), 1)
    assert.equal(await countRows('resolution_rules', { world_id: worldId }), 1)
  })
})
