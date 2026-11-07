import { test } from '@japa/runner'

import { gameEndOf } from '#services/game/game_lifecycle'
import { untilTheEnd, type DueEvent } from '#services/game/events'
import type { ScenarioEvent } from '#services/game/content/types'

/**
 * The end of a game (roadmap, Phase 12): one end a turn, by priority — death,
 * then defeat, then victory — and nothing falls after it.
 */

const won = { reason: 'victory' as const, event: 'princess_saved' }
const lost = { reason: 'defeat' as const, event: 'princess_eaten' }

test.group('The end of a game | one end a turn', () => {
  test('nothing ended, no end', ({ assert }) => {
    assert.isNull(gameEndOf(5, []))
  })

  test('at 0 hit points or fewer, the character dies', ({ assert }) => {
    assert.deepEqual(gameEndOf(0, []), { reason: 'death', event: null, discarded: [] })
    assert.deepEqual(gameEndOf(-3, []), { reason: 'death', event: null, discarded: [] })
  })

  test('death before a defeat, a defeat before a victory', ({ assert }) => {
    assert.deepEqual(gameEndOf(0, [won]), {
      reason: 'death',
      event: null,
      discarded: [won],
    })
    assert.deepEqual(gameEndOf(4, [won, lost]), { ...lost, discarded: [won] })
    assert.deepEqual(gameEndOf(0, [lost]), { reason: 'death', event: null, discarded: [lost] })
  })

  test('of two of a kind, the first proposed', ({ assert }) => {
    const later = { reason: 'victory' as const, event: 'treasure_found' }

    assert.deepEqual(gameEndOf(4, [won, later]), { ...won, discarded: [later] })
  })
})

test.group('The end of a game | nothing falls after it', () => {
  const event = (reference: string, ends: boolean): ScenarioEvent => ({
    reference,
    when: { at: { day: 1, period: null, time: null }, conditions: [], delay: null },
    unless: [],
    place: null,
    description: `${reference}.`,
    effects: ends ? [{ type: 'game_ended', outcome: 'failed' }] : [{ type: 'flag_set', flag: 'x' }],
    interrupts: false,
    foreseeable: null,
  })
  const due = (
    reference: string,
    at: number,
    ends = false,
    outcome: 'fired' | 'cancelled' = 'fired'
  ): DueEvent => ({
    event: event(reference, ends),
    at,
    outcome,
  })

  test('the timed events of a turn stop at the first that ends the game', ({ assert }) => {
    const plan = [due('bells', 10), due('ogre_eats', 20, true), due('dawn', 30)]

    assert.deepEqual(
      untilTheEnd(plan).map(({ event: { reference } }) => reference),
      ['bells', 'ogre_eats']
    )
  })

  test('one cancelled ends nothing', ({ assert }) => {
    const plan = [due('ogre_eats', 20, true, 'cancelled'), due('dawn', 30)]

    assert.lengthOf(untilTheEnd(plan), 2)
  })
})
