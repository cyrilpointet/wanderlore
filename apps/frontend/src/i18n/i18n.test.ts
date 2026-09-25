import { describe, expect, test } from 'vitest'

import i18n from './index'
import { errorMessage } from './errors'
import { GAME_STATUSES, MARGINS, RESULTS, STEPS, TURN_STATUSES } from '@/api/enums'

describe('i18n', () => {
  test.each([
    ['gameStatus', GAME_STATUSES],
    ['turnStatus', TURN_STATUSES],
    ['step', STEPS],
    ['result', RESULTS],
    ['margin', MARGINS],
  ])('labels every %s value', (group, values) => {
    for (const value of values) {
      expect(i18n.exists(`${group}.${value}`, { ns: 'enums' }), `${group}.${value}`).toBe(true)
    }
  })

  test('translates a known error code rather than showing the API message', () => {
    expect(errorMessage({ code: 'llm_timeout', message: 'raw API text' })).toBe(
      'The game master took too long to answer. Try your action again.'
    )
  })

  test('falls back on the API message for a code it does not know yet', () => {
    expect(errorMessage({ code: 'brand_new_code', message: 'raw API text' })).toBe('raw API text')
  })

  test('falls back on a generic message when the API sent none', () => {
    expect(errorMessage({ code: 'brand_new_code' })).toBe('Something went wrong.')
  })
})
