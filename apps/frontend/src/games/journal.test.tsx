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
  endedAt: null,
  endReason: null,
  characterId: 'character-1',
  world: { reference: 'three_musketeers', label: 'The Three Musketeers' },
  scenario: { id: 'scenario-1', title: 'A Gascon in Paris' },
  chapter: null,
  character: {
    name: "d'Artagnan",
    gender: 'male',
    profession: { reference: 'musketeer', label: 'Musketeer' },
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
  gameEnd: null,
}

const IDLE: EarlierTurns = { remain: true, load: () => {}, loading: false, error: null }

describe('Journal | on the sheet', () => {
  test('its scroll area is positioned, so the text kept for screen readers scrolls with the story', () => {
    const markup = renderToStaticMarkup(<Journal game={GAME} turns={[TURN]} />)

    // Positioned anywhere higher, that text would stretch the page below the table.
    expect(markup).toMatch(/<div class="relative h-full overflow-y-auto/)
  })
})

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
      opponent: { reference: 'jussac', label: 'Jussac', rank: null },
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
    combat: {
      role: 'defense',
      opponent: { reference: 'cahusac', label: null, rank: 2 },
      defense: 'dodge',
      outcome: 'struck',
    },
  }

  test('every roll of the turn as a chip, in order, with what it did', () => {
    const markup = renderToStaticMarkup(
      <Journal
        game={GAME}
        turns={[{ ...TURN, rolls: [thrust, dodge] }]}
        earlier={{ ...IDLE, remain: false }}
      />
    )

    expect(markup).toContain('<span> · Swordsmanship 60%</span><span> · rolled 23</span>')
    expect(markup).toContain('>Success · Hit</span>')
    // The modifier left out when it is nought; the damage on a line of its own.
    expect(markup).toContain('>Damage 5 · Armor −2 · → 3 dealt · Bleeding<')
    expect(markup).toContain(
      '>Dodge against unknown opponent 2</span><span> · Dodge 35%</span><span> · rolled 90</span>'
    )
    expect(markup).toContain('>Failure · Blow taken</span>')
    expect(markup.indexOf('rolled 23')).toBeLessThan(markup.indexOf('rolled 90'))
    expect(markup).not.toContain('Roll the dice')
  })
})

describe('Journal | the turn that ended the game', () => {
  const EPILOGUE = 'Years later, Paris still tells of the Gascon who saved the queen.'

  test.each([
    ['victory', 'Victory', 'text-success'],
    ['defeat', 'Defeat', 'text-danger'],
    ['death', 'Death', 'text-danger'],
  ] as const)(
    'ended by %s: the epilogue after the narration, then the stamp',
    (reason, stamp, tone) => {
      const markup = renderToStaticMarkup(
        <Journal
          game={{
            ...GAME,
            status: reason === 'victory' ? 'completed' : 'failed',
            endReason: reason,
          }}
          turns={[{ ...TURN, gameEnd: { reason, epilogue: EPILOGUE } }]}
        />
      )

      expect(markup).toContain('aria-label="The end of the story"')
      expect(markup.indexOf('He nods back.')).toBeLessThan(markup.indexOf(EPILOGUE))
      expect(markup.indexOf(EPILOGUE)).toBeLessThan(markup.indexOf(`>${stamp}</span>`))
      expect(markup).toMatch(new RegExp(`<span class="[^"]*${tone}[^"]*">${stamp}</span>`))
    }
  )

  test('without an epilogue — it could not be told — the stamp alone', () => {
    const markup = renderToStaticMarkup(
      <Journal
        game={{ ...GAME, status: 'failed', endReason: 'death' }}
        turns={[{ ...TURN, gameEnd: { reason: 'death', epilogue: null } }]}
      />
    )

    expect(markup).toContain('aria-label="The end of the story"')
    expect(markup).toContain('>Death</span>')
    expect(markup).toContain('He nods back.')
  })

  test('an ordinary turn tells no end', () => {
    const markup = renderToStaticMarkup(<Journal game={GAME} turns={[TURN]} />)

    expect(markup).not.toContain('The end of the story')
  })

  test('the end is pressed onto the sheet only when it came while the screen was open', () => {
    const turns = [{ ...TURN, gameEnd: { reason: 'victory' as const, epilogue: EPILOGUE } }]

    expect(
      renderToStaticMarkup(<Journal game={GAME} turns={turns} endedTurnId={TURN.id} />)
    ).toContain('animate-stamp-press')
    expect(renderToStaticMarkup(<Journal game={GAME} turns={turns} />)).not.toContain(
      'animate-stamp-press'
    )
  })

  test('held for its dice, the epilogue fades in with the narration once they are thrown', () => {
    const turns = [{ ...TURN, gameEnd: { reason: 'victory' as const, epilogue: EPILOGUE } }]
    const markup = renderToStaticMarkup(
      <Journal game={GAME} turns={turns} revealedTurnId={TURN.id} />
    )

    expect(markup.match(/animate-fade-in/g)).toHaveLength(2)
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
