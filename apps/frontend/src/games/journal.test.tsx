import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ApiError } from '@/api/client'
import { Journal, LoadEarlier, type EarlierTurns } from './journal'
import type { Game, Turn } from './queries'

const GAME: Game = {
  id: 'game-1',
  status: 'in_progress',
  lastActivityAt: '2026-10-11T10:00:00Z',
  world: { reference: 'three_musketeers', label: 'The Three Musketeers' },
  chapter: null,
  character: {
    name: "d'Artagnan",
    hitPoints: 10,
    hitPointsMax: 10,
    characteristics: [],
    skills: [],
    resources: [],
    inventory: [],
  },
  location: null,
  period: 'dusk',
  activeQuests: [],
  pendingTurn: null,
}

const TURN: Turn = {
  id: 'turn-21',
  turnNumber: 21,
  status: 'completed',
  playerInput: 'I bow to the captain.',
  roll: null,
  narration: 'He nods back.',
  effects: null,
  failure: null,
}

const IDLE: EarlierTurns = { remain: true, load: () => {}, loading: false, error: null }

describe('Journal | earlier turns', () => {
  test('offers to load earlier turns while some remain', () => {
    const markup = renderToStaticMarkup(<Journal game={GAME} turns={[TURN]} earlier={IDLE} />)

    expect(markup).toContain('Load earlier')
  })

  test('offers nothing once the story is loaded from its first turn', () => {
    const markup = renderToStaticMarkup(
      <Journal game={GAME} turns={[TURN]} earlier={{ ...IDLE, remain: false }} />
    )

    expect(markup).not.toContain('Load earlier')
  })
})

describe('LoadEarlier', () => {
  test('says it is loading, and cannot be pressed twice', () => {
    const markup = renderToStaticMarkup(<LoadEarlier onLoad={() => {}} loading error={null} />)

    expect(markup).toContain('Loading earlier turns…')
    expect(markup).toContain('disabled')
  })

  test('tells why a page could not be loaded', () => {
    const error = new ApiError(500, 'unexpected', 'Boom', null)
    const markup = renderToStaticMarkup(
      <LoadEarlier onLoad={() => {}} loading={false} error={error} />
    )

    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Load earlier')
  })
})
