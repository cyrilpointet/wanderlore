import { afterEach, describe, expect, test, vi } from 'vitest'

import { ApiError, NetworkError } from '@/api/client'
import {
  ClosedToAccountError,
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
  test('lets a game master and a superadmin in, and no one else', () => {
    expect(canUseBackOffice(GAME_MASTER)).toBe(true)
    expect(canUseBackOffice({ ...GAME_MASTER, role: 'superadmin' })).toBe(true)
    expect(canUseBackOffice({ ...GAME_MASTER, role: 'player' })).toBe(false)
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

  test('signs a superadmin in', async () => {
    const superadmin = { ...GAME_MASTER, role: 'superadmin' }
    respondInTurn([200, { data: { id: 'admin' } }], [200, { data: superadmin }])

    await expect(
      signIn({ email: 'admin@wanderlore.test', password: 'password' })
    ).resolves.toEqual(superadmin)
  })

  test('signs a player straight back out, and says why', async () => {
    const calls = respondInTurn(
      [200, { data: { id: 'player' } }],
      [200, { data: { ...GAME_MASTER, role: 'player' } }],
      [200, { message: 'Logged out successfully' }]
    )

    await expect(signIn({ email: 'player@wanderlore.test', password: 'password' })).rejects.toThrow(
      ClosedToAccountError
    )
    expect(calls.at(-1)).toEqual({ url: '/api/v1/account/logout', method: 'POST' })
  })
})

describe('signInErrorMessage', () => {
  test('tells a player the back-office is not for them', () => {
    expect(signInErrorMessage(new ClosedToAccountError())).toBe(
      'The back-office is for game masters and superadmins: it is closed to this account.'
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
  const SUPERADMIN: User = { ...GAME_MASTER, role: 'superadmin' }

  test('goes back to the page that was asked for, in one of the account’s sections', () => {
    expect(redirectTarget('/worlds/w1/npcs', GAME_MASTER as never)).toBe('/worlds/w1/npcs')
    expect(redirectTarget('/accounts?role=player', SUPERADMIN as never)).toBe(
      '/accounts?role=player'
    )
  })

  test('lands on the home of the role for a section of the other role', () => {
    expect(redirectTarget('/accounts', GAME_MASTER as never)).toBe('/worlds')
    expect(redirectTarget('/scenarios/s1', SUPERADMIN as never)).toBe('/accounts')
  })

  test.each([undefined, '', '/', 'https://evil.example', '//evil.example', '/login?redirect=/worlds'])(
    'lands on the home of the role otherwise (%s)',
    (requested) => {
      expect(redirectTarget(requested, GAME_MASTER as never)).toBe('/worlds')
      expect(redirectTarget(requested, SUPERADMIN as never)).toBe('/accounts')
    }
  )
})
