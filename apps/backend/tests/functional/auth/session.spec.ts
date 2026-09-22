import { test } from '@japa/runner'

import User from '#models/user'
import { createSession, useTransaction } from '#tests/helpers/database'

const LOGIN = '/api/v1/auth/login'
const LOGOUT = '/api/v1/account/logout'
const PROFILE = '/api/v1/account/profile'
const CSRF = '/api/v1/auth/csrf'

const CREDENTIALS = { email: 'session@wanderlore.test', password: 'password' }

/**
 * `createUser` from the helpers inserts a placeholder password straight through
 * the query builder; verifying credentials needs a real hash, so this spec goes
 * through the model.
 */
function createPlayer() {
  return User.create({ fullName: 'Session Player', ...CREDENTIALS })
}

test.group('Session login', (group) => {
  useTransaction(group)

  test('login opens a session and hands back no token', async ({ client, assert }) => {
    await createPlayer()

    const response = await client.post(LOGIN).json(CREDENTIALS).withCsrfToken()

    response.assertStatus(200)
    response.assertSession('auth_web')

    /**
     * The exit criterion of the decision: the browser never receives a
     * credential it could store outside the cookie jar.
     */
    assert.notProperty(response.body().data, 'token')
    assert.exists(response.cookie('adonis-session'))
  })

  test('the session cookie is httpOnly and same-site', async ({ client, assert }) => {
    await createPlayer()

    const response = await client.post(LOGIN).json(CREDENTIALS).withCsrfToken()
    const cookie = response.cookie('adonis-session')!

    assert.isTrue(cookie.httpOnly)
    assert.equal(String(cookie.sameSite).toLowerCase(), 'lax')
  })

  test('wrong credentials open no session', async ({ client }) => {
    await createPlayer()

    const response = await client
      .post(LOGIN)
      .json({ ...CREDENTIALS, password: 'not-the-password' })
      .withCsrfToken()

    response.assertStatus(400)
    response.assertSessionMissing('auth_web')
  })

  test('logout closes the session', async ({ client }) => {
    const user = await createPlayer()

    const response = await client.post(LOGOUT).loginAs(user).withCsrfToken()

    response.assertStatus(200)
    response.assertSessionMissing('auth_web')
  })
})

test.group('Protected routes', (group) => {
  useTransaction(group)

  test('the profile refuses an anonymous request', async ({ client }) => {
    const response = await client.get(PROFILE)

    response.assertStatus(401)
  })

  test('a game route refuses an anonymous request', async ({ client }) => {
    const user = await createPlayer()
    const sessionId = await createSession(user.id)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .withCsrfToken()

    response.assertStatus(401)
  })
})

test.group('CSRF protection', (group) => {
  useTransaction(group)

  test('a mutating request without a CSRF token is refused', async ({ client }) => {
    const user = await createPlayer()
    const sessionId = await createSession(user.id)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: 'I look around.' })
      .loginAs(user)

    /**
     * Authenticated, and still refused: the cookie alone is not enough, which
     * is the whole point of pairing cookie auth with CSRF.
     */
    response.assertStatus(403)
  })

  test('a CSRF token lets the same request through to validation', async ({ client }) => {
    const user = await createPlayer()
    const sessionId = await createSession(user.id)

    const response = await client
      .post(`/api/v1/sessions/${sessionId}/turns`)
      .json({ playerInput: '   ' })
      .loginAs(user)
      .withCsrfToken()

    /**
     * 422, not 403: the request reached the validator, so CSRF let it pass.
     */
    response.assertStatus(422)
  })

  test('a read request needs no token', async ({ client }) => {
    const user = await createPlayer()

    const response = await client.get(PROFILE).loginAs(user)

    response.assertStatus(200)
  })

  test('scripted clients can read the raw token', async ({ client, assert }) => {
    const response = await client.get(CSRF)

    response.assertStatus(200)
    const { csrfToken } = response.body() as { csrfToken: string }
    assert.isNotEmpty(csrfToken)

    /**
     * The browser front ignores this route and reads the cookie instead, which
     * shield exposes to JavaScript on purpose.
     */
    const cookie = response.cookie('XSRF-TOKEN')!
    assert.isNotTrue(cookie.httpOnly)
  })
})
