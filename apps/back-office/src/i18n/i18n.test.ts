import { describe, expect, test } from 'vitest'

import { errorMessage } from './errors'

describe('i18n', () => {
  test('translates a known error code rather than showing the API message', () => {
    expect(errorMessage({ code: 'forbidden_role', message: 'raw API text' })).toBe(
      'This account cannot do that.'
    )
  })

  test('falls back on the API message for a code it does not know yet', () => {
    expect(errorMessage({ code: 'brand_new_code', message: 'raw API text' })).toBe('raw API text')
  })
})
