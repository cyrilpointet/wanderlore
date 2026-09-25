import { describe, expect, test } from 'vitest'

import { ApiError, NetworkError } from '@/api/client'
import { HOME, redirectTarget, signInErrorMessage } from './session'

describe('redirectTarget', () => {
  test('goes back to the page that was asked for', () => {
    expect(redirectTarget('/games/42?tab=sheet')).toBe('/games/42?tab=sheet')
  })

  test('lands on the games list when nothing was asked for', () => {
    expect(redirectTarget(undefined)).toBe(HOME)
    expect(redirectTarget('')).toBe(HOME)
  })

  test.each(['https://evil.example', '//evil.example/games', 'javascript:alert(1)', 'games'])(
    'never leaves the app for %s',
    (requested) => {
      expect(redirectTarget(requested)).toBe(HOME)
    }
  )

  test('never loops back to the sign-in page', () => {
    expect(redirectTarget('/login?redirect=/games')).toBe(HOME)
  })
})

describe('signInErrorMessage', () => {
  test.each([400, 422])('reads refused credentials the same way (%i)', (status) => {
    expect(signInErrorMessage(new ApiError(status, undefined, 'raw', {}))).toBe(
      'Invalid email or password.'
    )
  })

  test('says the connection was lost when the request never got an answer', () => {
    expect(signInErrorMessage(new NetworkError(new TypeError()))).toBe('Connection lost.')
  })

  test('stays generic for a server failure', () => {
    expect(signInErrorMessage(new ApiError(500, undefined, 'Internal', {}))).toBe(
      'Something went wrong.'
    )
  })
})
