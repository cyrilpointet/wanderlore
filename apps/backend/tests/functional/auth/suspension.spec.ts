import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import User from '#models/user'
import { seedMusketeers } from '#tests/helpers/content'
import { createCharacter, createSession, useTransaction } from '#tests/helpers/database'

const LOGIN = '/api/v1/auth/login'
const CREDENTIALS = { email: 'suspended@wanderlore.test', password: 'password' }

function bodyOf(response: { body(): unknown }): any {
  return response.body()
}

/** Through the model: signing in needs a real password hash. */
function createAccount(role: 'player' | 'game_master' = 'player') {
  return User.create({ fullName: 'Suspended Player', ...CREDENTIALS, role })
}

async function suspend(user: User) {
  user.suspendedAt = DateTime.now()
  await user.save()
}

async function reactivate(user: User) {
  user.suspendedAt = null
  await user.save()
}

test.group('Suspension | signing in', (group) => {
  useTransaction(group)

  test('a suspended account cannot sign in, even with the right password', async ({
    client,
    assert,
  }) => {
    await suspend(await createAccount())

    const response = await client.post(LOGIN).json(CREDENTIALS).withCsrfToken()

    response.assertStatus(403)
    assert.equal(bodyOf(response).error.code, 'account_suspended')
    response.assertSessionMissing('auth_web')
  })

  test('wrong credentials say nothing about the suspension', async ({ client, assert }) => {
    await suspend(await createAccount())

    const response = await client
      .post(LOGIN)
      .json({ ...CREDENTIALS, password: 'not-the-password' })
      .withCsrfToken()

    response.assertStatus(400)
    assert.notInclude(JSON.stringify(response.body()), 'suspended')
  })

  test('a reactivated account signs in again', async ({ client }) => {
    const user = await createAccount()
    await suspend(user)
    await reactivate(user)

    const response = await client.post(LOGIN).json(CREDENTIALS).withCsrfToken()

    response.assertStatus(200)
  })
})

test.group('Suspension | a session already open', (group) => {
  useTransaction(group)

  test('is cut on its next request to the game', async ({ client, assert }) => {
    const user = await createAccount()
    await suspend(user)

    const response = await client.get('/api/v1/sessions').loginAs(user)

    response.assertStatus(401)
    assert.equal(bodyOf(response).error.code, 'account_suspended')
  })

  test('is cut on its next request to the back-office', async ({ client, assert }) => {
    const user = await createAccount('game_master')
    await suspend(user)

    const response = await client.get('/api/v1/admin/worlds').loginAs(user)

    response.assertStatus(401)
    assert.equal(bodyOf(response).error.code, 'account_suspended')
  })

  test('cannot subscribe to a game channel', async ({ client }) => {
    const user = await createAccount()
    const sessionId = await createSession(user.id, await seedMusketeers())
    await suspend(user)

    const response = await client
      .post('/__transmit/subscribe')
      .json({ uid: 'suspended-client', channel: `sessions/${sessionId}` })
      .loginAs(user)
      .withCsrfToken()

    response.assertStatus(401)
  })

  test('finds its games intact once reactivated', async ({ client, assert }) => {
    const user = await createAccount()
    const sessionId = await createSession(user.id, await seedMusketeers())
    await createCharacter(sessionId)
    await suspend(user)
    await reactivate(user)

    const response = await client.get('/api/v1/sessions').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(
      bodyOf(response).data.map(({ id }: { id: string }) => id),
      [sessionId]
    )
  })
})
