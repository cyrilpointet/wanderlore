import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import User from '#models/user'
import {
  PG_INVALID_TEXT_REPRESENTATION,
  createUser,
  expectDbError,
  useTransaction,
} from '#tests/helpers/database'

const SIGNUP = '/api/v1/auth/signup'
const PROFILE = '/api/v1/account/profile'

function signupPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'New Player',
    email: `signup-${Date.now()}-${Math.random()}@wanderlore.test`,
    password: 'password',
    passwordConfirmation: 'password',
    ...overrides,
  }
}

test.group('Account role', (group) => {
  useTransaction(group)

  test('a new account is a player', async ({ client, assert }) => {
    const payload = signupPayload()

    const response = await client.post(SIGNUP).json(payload)
    response.assertStatus(200)

    /**
     * The default lives in the migration, not in application code — nothing
     * else guards it.
     */
    const row = await db.from('users').where({ email: payload.email }).firstOrFail()
    assert.equal(row.role, 'player')
  })

  test('the role is never exposed by the API', async ({ client, assert }) => {
    const payload = signupPayload()

    const signup = await client.post(SIGNUP).json(payload)
    const user = await User.findByOrFail('email', payload.email)
    const profile = await client.get(PROFILE).loginAs(user)

    /**
     * Deliberate: `UserTransformer` is an explicit allowlist and omits `role`.
     * Authorisation is a backend concern, and the role is not part of the API
     * contract until the back-office arrives in Phase 5.
     *
     * Whoever needs to expose it will have to delete this test — and read why.
     */
    assert.notProperty(signup.body().data.user, 'role')
    assert.notProperty(profile.body().data, 'role')
  })

  test('the role cannot be set through the signup payload', async ({ client, assert }) => {
    const payload = signupPayload({ role: 'superadmin' })

    await client.post(SIGNUP).json(payload)

    /**
     * The privilege-escalation guard. `signupValidator` drops unknown fields
     * today; this pins that behaviour so a future rewrite of the validator
     * cannot quietly open the door.
     */
    const row = await db.from('users').where({ email: payload.email }).firstOrFail()
    assert.equal(row.role, 'player')
  })

  test('the database rejects a role outside the enum', async ({ assert }) => {
    const error = await expectDbError(() => createUser({ role: 'admin' }))

    /**
     * The native enum is the real guard, not application-level validation.
     */
    assert.equal(error.code, PG_INVALID_TEXT_REPRESENTATION)
  })

  test('each of the three roles is accepted', async ({ assert }) => {
    for (const role of ['player', 'game_master', 'superadmin']) {
      const id = await createUser({ role })
      assert.isString(id)
    }
  })
})
