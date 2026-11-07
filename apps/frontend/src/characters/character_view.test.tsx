import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { withRouter } from '@/test/router'
import { CharacterView } from './character_view'
import type { CharacterDetail } from './queries'

const FREE: CharacterDetail = {
  id: 'character-1',
  name: 'Anne de Breuil',
  gender: 'female',
  world: { reference: 'three_musketeers', label: 'The Three Musketeers' },
  profession: { reference: 'spy', label: 'Spy' },
  createdAt: '2026-10-01T10:00:00Z',
  characteristics: [
    { reference: 'STR', value: 9 },
    { reference: 'CON', value: 12 },
    { reference: 'SIZ', value: 10 },
    { reference: 'INT', value: 16 },
    { reference: 'POW', value: 14 },
    { reference: 'DEX', value: 15 },
    { reference: 'CHA', value: 17 },
  ],
  skills: [{ reference: 'persuade', label: 'Persuade', value: 65, category: 'communication' }],
  engaged: false,
  game: null,
  scenarios: [
    {
      id: 'scenario-1',
      title: 'The Golden Lion',
      synopsis: 'An inn, a letter, a duel.',
      status: 'published',
      failed: true,
    },
    {
      id: 'scenario-2',
      title: 'The Drowned Anchor',
      synopsis: 'A Breton inn by the sea.',
      status: 'draft',
      failed: false,
    },
  ],
  pastGames: [
    {
      id: 'game-3',
      status: 'failed',
      endedAt: '2026-10-10T10:00:00Z',
      endReason: 'death',
      scenario: { id: 'scenario-1', title: 'The Golden Lion' },
    },
    {
      id: 'game-2',
      status: 'completed',
      endedAt: '2026-10-05T10:00:00Z',
      endReason: 'victory',
      scenario: { id: 'scenario-9', title: 'The Grain Road' },
    },
  ],
}

const ENGAGED: CharacterDetail = {
  ...FREE,
  engaged: true,
  game: {
    id: 'game-7',
    status: 'paused',
    lastActivityAt: '2026-10-11T10:00:00Z',
    scenario: { id: 'scenario-2', title: 'The Drowned Anchor' },
    chapter: null,
    hitPoints: 20,
    hitPointsMax: 22,
  },
}

function render(character: CharacterDetail, startError: string | null = null) {
  return renderToStaticMarkup(
    withRouter(
      <CharacterView
        character={character}
        starting={null}
        startError={startError}
        onStart={() => {}}
        onAbandon={() => {}}
        onDeleteGame={() => {}}
        onDeleteCharacter={() => {}}
      />
    )
  )
}

describe('CharacterView', () => {
  test('shows who the character is: gender, profession, world and sheet', () => {
    const html = render(FREE)

    for (const text of [
      'Anne de Breuil',
      'Spy · Female',
      'The Three Musketeers',
      'Charisma',
      'Persuade',
      '65%',
    ]) {
      expect(html).toContain(text)
    }
  })

  test('a character in no game: the scenarios to play, and a way to delete them', () => {
    const html = render(FREE)

    expect(html).toContain('The Golden Lion')
    expect(html).toContain('An inn, a letter, a duel.')
    expect(html).toContain('Failed — try again')
    expect(html).toContain('Draft')
    expect(html).toContain('Play')
    expect(html).toContain('Delete this character')
    expect(html).not.toContain('Current game')
  })

  test('a character in a game: Continue and Abandon, no scenario, no deletion', () => {
    const html = render(ENGAGED)

    expect(html).toContain('Current game')
    expect(html).toContain('href="/games/game-7"')
    expect(html).toContain('Continue')
    expect(html).toContain('Abandon')
    expect(html).toContain('Paused')
    expect(html).not.toContain('>Play<')
    expect(html).not.toContain('Delete this character')
  })

  test('shows no hit points outside a game: they belong to the current game', () => {
    expect(render(FREE)).not.toContain('Hit points')
    expect(render(ENGAGED)).toContain('Hit points: 20 of 22')
  })

  test('lists the games played, each read again, only the failed one deletable', () => {
    const html = render(FREE)

    expect(html).toContain('Past games')
    expect(html).toContain('href="/games/game-3"')
    expect(html).toContain('href="/games/game-2"')
    expect(html).toContain('Delete the game of The Golden Lion')
    expect(html).not.toContain('Delete the game of The Grain Road')
  })

  test.each([
    ['victory', 'completed', 'Victory', 'text-success'],
    ['defeat', 'failed', 'Defeat', 'text-danger'],
    ['death', 'failed', 'Death', 'text-danger'],
    ['abandoned', 'failed', 'Abandoned', 'text-danger'],
  ] as const)(
    'a past game ended by %s is stamped with its reason',
    (reason, status, stamp, tone) => {
      const html = render({
        ...FREE,
        pastGames: [{ ...FREE.pastGames[0]!, status, endReason: reason }],
      })

      expect(html).toMatch(new RegExp(`<span class="[^"]*${tone}[^"]*">${stamp}</span>`))
      expect(html).not.toContain('Failed<')
      expect(html).not.toContain('Completed<')
    }
  )

  test('a past game without a reason keeps its outcome', () => {
    const html = render({
      ...FREE,
      pastGames: [{ ...FREE.pastGames[0]!, status: 'failed', endReason: null }],
    })

    expect(html).toContain('>Failed</span>')
  })

  test('a scenario won is no longer offered: the page reads well with none left', () => {
    const html = render({ ...FREE, scenarios: [] })

    expect(html).toContain('No scenario left to play in this world.')
    expect(html).toContain('Victory')
  })

  test('says why a game could not start', () => {
    expect(render(FREE, 'This scenario cannot be played yet.')).toContain(
      'This scenario cannot be played yet.'
    )
  })
})
