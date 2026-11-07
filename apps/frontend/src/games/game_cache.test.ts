import { describe, expect, test } from 'vitest'

import { isClosed, withGameEnd } from './game_cache'
import type { Game } from './queries'

const GAME = {
  id: 'game-1',
  status: 'in_progress',
  endedAt: null,
  endReason: null,
  pendingTurn: { id: 'turn-1' },
} as Game

describe('the end of a game in the cache', () => {
  test('a game played is not closed', () => {
    expect(isClosed(GAME)).toBe(false)
  })

  test('the turn that ended it closes it at once, for its reason, with no turn pending', () => {
    const ended = withGameEnd(GAME, 'death')

    expect(ended).toMatchObject({ endReason: 'death', pendingTurn: null })
    expect(isClosed(ended)).toBe(true)
  })

  test('a game read back over is closed, whatever its reason', () => {
    expect(isClosed({ status: 'failed', endReason: 'abandoned' })).toBe(true)
    expect(isClosed({ status: 'completed', endReason: 'victory' })).toBe(true)
    expect(isClosed({ status: 'failed', endReason: null })).toBe(true)
  })
})
