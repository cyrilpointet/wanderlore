import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ApiError } from '@/api/client'
import { Journal, LoadEarlier, type EarlierTurns } from './journal'
import type { Game, Roll, Turn } from './queries'

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
  rolls: [],
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

describe('Journal | a round of combat read back', () => {
  const thrust: Roll = {
    skill: { reference: 'swordsmanship', label: 'Swordsmanship' },
    characteristic: null,
    value: 60,
    baseChance: 60,
    difficulty: 'average',
    modifiers: [],
    chance: 60,
    roll: 23,
    result: 'success',
    degree: 'success',
    combat: {
      role: 'attack',
      outcome: 'hit',
      damage: { weapon: 5, modifier: 0, armor: 2, total: 3, effect: 'bleeding' },
    },
  }
  const dodge: Roll = {
    ...thrust,
    skill: { reference: 'dodge', label: 'Dodge' },
    value: 35,
    baseChance: 35,
    chance: 35,
    roll: 90,
    result: 'failure',
    degree: 'failure',
    combat: { role: 'defense', defense: 'dodge', outcome: 'struck' },
  }

  test('every roll of the turn as a chip, in order, with what it did', () => {
    const markup = renderToStaticMarkup(
      <Journal
        game={GAME}
        turns={[{ ...TURN, rolls: [thrust, dodge] }]}
        earlier={{ ...IDLE, remain: false }}
      />
    )

    expect(markup).toContain('Swordsmanship 60% · rolled 23 · Success · Hit')
    // The modifier left out when it is nought; the damage on a line of its own.
    expect(markup).toContain('>Damage 5 · Armor −2 · → 3 dealt · Bleeding<')
    expect(markup).toContain('Dodge · Dodge 35% · rolled 90 · Failure · Blow taken')
    expect(markup.indexOf('rolled 23')).toBeLessThan(markup.indexOf('rolled 90'))
    expect(markup).not.toContain('Roll the dice')
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
