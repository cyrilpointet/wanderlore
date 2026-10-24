import { describe, expect, test } from 'vitest'

import { canVisit, homeOf, SECTIONS } from './sections'

describe('sections', () => {
  test('one account, one role: each role sees its own sections only', () => {
    expect(SECTIONS.game_master).toEqual(['worlds'])
    expect(SECTIONS.superadmin).toEqual(['accounts'])
  })

  test('each role lands on its first section', () => {
    expect(homeOf('game_master')).toBe('/worlds')
    expect(homeOf('superadmin')).toBe('/accounts')
  })

  test('a game master visits the worlds and their scenarios, not the accounts', () => {
    expect(canVisit('game_master', '/worlds')).toBe(true)
    expect(canVisit('game_master', '/worlds/w1/items')).toBe(true)
    expect(canVisit('game_master', '/scenarios/s1')).toBe(true)
    expect(canVisit('game_master', '/accounts')).toBe(false)
  })

  test('a superadmin visits the accounts, not the content', () => {
    expect(canVisit('superadmin', '/accounts')).toBe(true)
    expect(canVisit('superadmin', '/worlds')).toBe(false)
    expect(canVisit('superadmin', '/scenarios/s1/npcs')).toBe(false)
  })

  test('a path of no section is open to both', () => {
    expect(canVisit('superadmin', '/')).toBe(true)
    expect(canVisit('game_master', '/')).toBe(true)
  })

  test('a section is matched on whole path segments', () => {
    expect(canVisit('superadmin', '/worldsmith')).toBe(true)
  })
})
