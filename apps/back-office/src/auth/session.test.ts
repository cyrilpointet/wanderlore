import { afterEach, describe, expect, test, vi } from 'vitest'

import { ApiError, NetworkError } from '@/api/client'
import {
  HOME,
  NotAGameMasterError,
  canUseBackOffice,
  redirectTarget,
  signIn,
  signInErrorMessage,
  type User,
} from './session'

const GAME_MASTER: User = {
  id: 'gm',
  fullName: 'Test Game Master',
  email: 'gm@wanderlore.test',
  initials: 'TG',
  role: 'game_master',
}

/** Answers each request in turn, recording what was asked. */
function respondInTurn(...answers: [number, unknown][]) {
  const calls: { url: string; method: string }[] = []
  vi.stubGlobal('document', { cookie: '' })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { method: string }) => {
      calls.push({ url, method: init.method })
      const [status, body] = answers.shift()!
      return new Response(JSON.stringify(body), { status })
    })
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('canUseBackOffice', () => {
  test('lets a game master in, and no one else', () => {
    expect(canUseBackOffice(GAME_MASTER)).toBe(true)
    expect(canUseBackOffice({ ...GAME_MASTER, role: 'player' })).toBe(false)
    expect(canUseBackOffice({ ...GAME_MASTER, role: 'superadmin' })).toBe(false)
    expect(canUseBackOffice(null)).toBe(false)
  })
})

describe('signIn', () => {
  test('signs a game master in', async () => {
    respondInTurn([200, { data: { id: 'gm' } }], [200, { data: GAME_MASTER }])

    await expect(signIn({ email: 'gm@wanderlore.test', password: 'password' })).resolves.toEqual(
      GAME_MASTER
    )
  })

  test('signs a player straight back out, and says why', async () => {
    const calls = respondInTurn(
      [200, { data: { id: 'player' } }],
      [200, { data: { ...GAME_MASTER, role: 'player' } }],
      [200, { message: 'Logged out successfully' }]
    )

    await expect(signIn({ email: 'player@wanderlore.test', password: 'password' })).rejects.toThrow(
      NotAGameMasterError
    )
    expect(calls.at(-1)).toEqual({ url: '/api/v1/account/logout', method: 'POST' })
  })
})

describe('signInErrorMessage', () => {
  test('tells a player the back-office is not for them', () => {
    expect(signInErrorMessage(new NotAGameMasterError())).toBe(
      "This account is not a game master's: the back-office is closed to it."
    )
  })

  test.each([400, 422])('reads refused credentials the same way (%i)', (status) => {
    expect(signInErrorMessage(new ApiError(status, undefined, 'raw', {}))).toBe(
      'Invalid email or password.'
    )
  })

  test('says the connection was lost when the request never got an answer', () => {
    expect(signInErrorMessage(new NetworkError(new TypeError()))).toBe('Connection lost.')
  })
})

describe('redirectTarget', () => {
  test('goes back to the page that was asked for', () => {
    expect(redirectTarget('/worlds')).toBe('/worlds')
  })

  test.each([undefined, '', 'https://evil.example', '//evil.example', '/login?redirect=/worlds'])(
    'lands on the worlds otherwise (%s)',
    (requested) => {
      expect(redirectTarget(requested)).toBe(HOME)
    }
  )
})
