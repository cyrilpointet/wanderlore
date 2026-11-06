import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { withRouter } from '@/test/router'
import { CharacterCard, WorldCard } from './character_card'
import type { CharacterSummary } from './queries'

const FREE: CharacterSummary = {
  id: 'character-1',
  name: "d'Artagnan",
  gender: 'male',
  world: { reference: 'three_musketeers', label: 'The Three Musketeers' },
  profession: { reference: 'musketeer', label: 'Musketeer' },
  createdAt: '2026-10-01T10:00:00Z',
  lastActivityAt: '2026-10-11T10:00:00Z',
  game: null,
}

const ENGAGED: CharacterSummary = {
  ...FREE,
  game: {
    id: 'game-7',
    status: 'in_progress',
    lastActivityAt: '2026-10-11T10:00:00Z',
    scenario: { id: 'scenario-1', title: 'A Gascon in Paris' },
    chapter: { reference: 'road_to_paris', label: 'The Road to Paris' },
    hitPoints: 8,
    hitPointsMax: 26,
  },
}

const render = (character: CharacterSummary) =>
  renderToStaticMarkup(withRouter(<CharacterCard character={character} />))

describe('CharacterCard', () => {
  test('names the character, their profession and their world, and opens their page', () => {
    const html = render(FREE)

    expect(html).toContain('d&#x27;Artagnan')
    expect(html).toContain('Musketeer')
    // The world is written on the card's tab, not repeated under the name.
    expect(html).toContain('The Three Musketeers')
    expect(html).not.toContain('Musketeer · The Three Musketeers')
    expect(html).toContain('href="/characters/character-1"')
    expect(html).not.toContain('Continue')
  })

  test('shows the game an engaged character plays, with a way straight back to it', () => {
    const html = render(ENGAGED)

    for (const text of ['Playing', 'A Gascon in Paris', 'The Road to Paris', '8 / 26']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('href="/games/game-7"')
    expect(html).toContain('Continue')
  })

  test('says so when the game is paused', () => {
    const html = render({ ...ENGAGED, game: { ...ENGAGED.game!, status: 'paused' } })

    expect(html).toContain('Paused')
    expect(render(ENGAGED)).not.toContain('Paused')
  })

  test('leaves the hit points out when the game has none yet', () => {
    const html = render({
      ...ENGAGED,
      game: { ...ENGAGED.game!, hitPoints: null, hitPointsMax: null },
    })

    expect(html).not.toContain(' / ')
  })
})

describe('WorldCard', () => {
  test('shows the world and its tone, and leads to the creation', () => {
    const html = renderToStaticMarkup(
      withRouter(
        <WorldCard
          world={{ id: 'world-1', label: 'The Three Musketeers', tone: 'Cloak and dagger.' }}
        />
      )
    )

    expect(html).toContain('The Three Musketeers')
    expect(html).toContain('Cloak and dagger.')
    expect(html).toContain('href="/worlds/world-1/new-character"')
    expect(html).toContain('Create a character')
  })
})
