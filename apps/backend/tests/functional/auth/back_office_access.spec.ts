import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import GameMasterSeeder from '#database/seeders/03_test_game_master_seeder'
import { seedContent } from '#tests/helpers/content'
import { countRows, createUser, useTransaction } from '#tests/helpers/database'

const WORLDS = '/api/v1/admin/worlds'

async function userWith(role: 'player' | 'game_master' | 'superadmin'): Promise<User> {
  return User.findOrFail(await createUser({ role }))
}

test.group('Back-office | access', (group) => {
  useTransaction(group)

  test('turns an anonymous visitor away', async ({ client }) => {
    const response = await client.get(WORLDS)

    response.assertStatus(401)
  })

  test('refuses a player, with a code the front can name', async ({ client, assert }) => {
    const response = await client.get(WORLDS).loginAs(await userWith('player'))

    response.assertStatus(403)
    assert.equal((response.body() as any).error.code, 'forbidden_role')
  })

  test('refuses a superadmin too: it manages accounts, not content', async ({ client }) => {
    const response = await client.get(WORLDS).loginAs(await userWith('superadmin'))

    response.assertStatus(403)
  })

  test('lets a game master list the worlds', async ({ client, assert }) => {
    await seedContent()

    const response = await client.get(WORLDS).loginAs(await userWith('game_master'))

    response.assertStatus(200)
    const world = (response.body() as any).data.find(
      ({ reference }: { reference: string }) => reference === 'three_musketeers'
    )
    assert.deepEqual(world.labels, { en: 'The Three Musketeers' })
    assert.equal(world.scenarioCount, THREE_MUSKETEERS_CONTENT.scenarios.length)
  })
})

test.group('Back-office | test account', (group) => {
  useTransaction(group)

  test('seeds one game master, however often it runs', async ({ assert }) => {
    await new GameMasterSeeder(db.connection()).run()
    await new GameMasterSeeder(db.connection()).run()

    assert.equal(await countRows('users', { email: 'gm@wanderlore.test' }), 1)
    const row = await db.from('users').where('email', 'gm@wanderlore.test').firstOrFail()
    assert.equal(row.role, 'game_master')
  })
})
