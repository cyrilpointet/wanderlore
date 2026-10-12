import { describe, expect, test } from 'vitest'

import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  test('follows the system while the player has not chosen', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
  })

  test("keeps the player's choice whatever the system says", () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})
