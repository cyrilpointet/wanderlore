import { describe, expect, test } from 'vitest'

import i18n from '@/i18n'
import { accountPayloadOf, emptyAccountDraft } from './account_draft'
import { ACCOUNT_STATUSES, ROLES } from './queries'

describe('account enums', () => {
  test.each([
    ['roles', ROLES],
    ['statuses', ACCOUNT_STATUSES],
  ])('labels every %s value', (group, values) => {
    for (const value of values) {
      expect(i18n.exists(`${group}.${value}`, { ns: 'accounts' }), `${group}.${value}`).toBe(true)
    }
  })
})

describe('account draft', () => {
  test('starts as a player', () => {
    expect(emptyAccountDraft().role).toBe('player')
  })

  test('trims the name and the email, never the password', () => {
    expect(
      accountPayloadOf({
        fullName: '  Ada  ',
        email: ' ada@wanderlore.test ',
        password: ' spaced pass ',
        role: 'game_master',
      })
    ).toEqual({
      fullName: 'Ada',
      email: 'ada@wanderlore.test',
      password: ' spaced pass ',
      role: 'game_master',
    })
  })
})
