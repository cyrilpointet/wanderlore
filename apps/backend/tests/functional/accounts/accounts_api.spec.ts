import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'

import User from '#models/user'
import { suspendAccount } from '#services/accounts'
import { createUser, useTransaction } from '#tests/helpers/database'

const ACCOUNTS = '/api/v1/admin/accounts'

function bodyOf(response: { body(): unknown }): any {
  return response.body()
}

async function userWith(
  role: 'player' | 'game_master' | 'superadmin',
  email?: string
): Promise<User> {
  return User.findOrFail(await createUser({ role, ...(email ? { email } : {}) }))
}

function as(client: ApiClient, user: User) {
  return {
    list: (query = '') => client.get(`${ACCOUNTS}${query}`).loginAs(user),
    create: (body: object) => client.post(ACCOUNTS).json(body).loginAs(user).withCsrfToken(),
    suspend: (id: string) => client.post(`${ACCOUNTS}/${id}/suspend`).loginAs(user).withCsrfToken(),
    reactivate: (id: string) =>
      client.post(`${ACCOUNTS}/${id}/reactivate`).loginAs(user).withCsrfToken(),
  }
}

const NEW_ACCOUNT = {
  fullName: 'New Game Master',
  email: 'new-gm@wanderlore.test',
  password: 'a-long-password',
  role: 'game_master',
}

test.group('Accounts API | listing', (group) => {
  useTransaction(group)

  test('lists every account with its role and status', async ({ client, assert }) => {
    const admin = await userWith('superadmin', 'list-admin@wanderlore.test')
    const player = await userWith('player', 'list-player@wanderlore.test')
    player.suspendedAt = DateTime.now()
    await player.save()

    const response = await as(client, admin).list()

    response.assertStatus(200)
    const accounts = bodyOf(response).data
    const listed = accounts.find(({ id }: { id: string }) => id === player.id)
    assert.equal(listed.role, 'player')
    assert.equal(listed.status, 'suspended')
    assert.isString(listed.suspendedAt)
    assert.notProperty(listed, 'password')
  })

  test('narrows to a role or a status', async ({ client, assert }) => {
    const admin = await userWith('superadmin')
    await userWith('game_master')
    const suspended = await userWith('player')
    suspended.suspendedAt = DateTime.now()
    await suspended.save()

    const masters = bodyOf(await as(client, admin).list('?role=game_master')).data
    const suspendedOnes = bodyOf(await as(client, admin).list('?status=suspended')).data

    assert.isTrue(masters.every(({ role }: { role: string }) => role === 'game_master'))
    assert.deepEqual(
      suspendedOnes.map(({ id }: { id: string }) => id),
      [suspended.id]
    )
  })

  test('refuses an unknown filter value', async ({ client }) => {
    const response = await as(client, await userWith('superadmin')).list('?role=admin')

    response.assertStatus(422)
  })
})

test.group('Accounts API | creating', (group) => {
  useTransaction(group)

  test('creates an account of each role, which can then sign in', async ({ client, assert }) => {
    const admin = await userWith('superadmin')

    for (const role of ['player', 'game_master', 'superadmin']) {
      const email = `created-${role}@wanderlore.test`
      const response = await as(client, admin).create({ ...NEW_ACCOUNT, email, role })

      response.assertStatus(201)
      assert.equal(bodyOf(response).data.role, role)
      assert.equal(bodyOf(response).data.status, 'active')

      const login = await client
        .post('/api/v1/auth/login')
        .json({ email, password: NEW_ACCOUNT.password })
        .withCsrfToken()
      login.assertStatus(200)
    }
  })

  test('refuses an email already taken, on its field', async ({ client, assert }) => {
    const admin = await userWith('superadmin')
    await createUser({ email: NEW_ACCOUNT.email })

    const response = await as(client, admin).create(NEW_ACCOUNT)

    response.assertStatus(422)
    assert.include(
      bodyOf(response).errors.map(({ field }: { field: string }) => field),
      'email'
    )
  })

  test('refuses an invalid payload, naming the field at fault', async ({ client, assert }) => {
    const admin = await userWith('superadmin')

    const response = await as(client, admin).create({
      ...NEW_ACCOUNT,
      password: 'short',
      role: 'admin',
    })

    response.assertStatus(422)
    assert.includeMembers(
      bodyOf(response).errors.map(({ field }: { field: string }) => field),
      ['password', 'role']
    )
  })
})

test.group('Accounts API | suspending', (group) => {
  useTransaction(group)

  test('suspends then reactivates an account', async ({ client, assert }) => {
    const admin = await userWith('superadmin')
    const player = await userWith('player')

    const suspended = await as(client, admin).suspend(player.id)
    suspended.assertStatus(200)
    assert.equal(bodyOf(suspended).data.status, 'suspended')

    const reactivated = await as(client, admin).reactivate(player.id)
    reactivated.assertStatus(200)
    assert.equal(bodyOf(reactivated).data.status, 'active')
    const row = await db.from('users').where('id', player.id).firstOrFail()
    assert.isNull(row.suspended_at)
  })

  test('keeps the date an account was first suspended on', async ({ client, assert }) => {
    const admin = await userWith('superadmin')
    const player = await userWith('player')
    const first = bodyOf(await as(client, admin).suspend(player.id)).data.suspendedAt

    const again = bodyOf(await as(client, admin).suspend(player.id)).data.suspendedAt

    assert.equal(again, first)
  })

  test('a superadmin cannot suspend themselves', async ({ client, assert }) => {
    const admin = await userWith('superadmin')
    await userWith('superadmin')

    const response = await as(client, admin).suspend(admin.id)

    response.assertStatus(409)
    assert.equal(bodyOf(response).error.code, 'cannot_suspend_self')
  })

  test('another superadmin can be suspended', async ({ client }) => {
    const admin = await userWith('superadmin')
    const other = await userWith('superadmin')

    const response = await as(client, admin).suspend(other.id)

    response.assertStatus(200)
  })

  test('the last active superadmin cannot be suspended', async ({ assert }) => {
    /**
     * Out of reach through the API — whoever asks is an active superadmin
     * and cannot suspend themselves — but the rule holds on its own.
     */
    await db.from('users').where('role', 'superadmin').update({ suspended_at: new Date() })
    const last = await userWith('superadmin')
    const actor = await userWith('player')

    await assert.rejects(() => suspendAccount(actor, last), /last active superadmin/)
  })

  test('answers 404 for an account that does not exist', async ({ client }) => {
    const response = await as(client, await userWith('superadmin')).suspend(
      '00000000-0000-4000-8000-000000000000'
    )

    response.assertStatus(404)
  })
})

test.group('Accounts API | access', (group) => {
  useTransaction(group)

  test('is for superadmins only', async ({ client }) => {
    for (const role of ['player', 'game_master'] as const) {
      const response = await as(client, await userWith(role)).list()

      response.assertStatus(403)
    }
  })

  test('a superadmin cannot reach the content', async ({ client }) => {
    const response = await client.get('/api/v1/admin/worlds').loginAs(await userWith('superadmin'))

    response.assertStatus(403)
  })
})
