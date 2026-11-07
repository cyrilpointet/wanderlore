import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { Game } from './queries'
import { SceneTag } from './scene_tag'

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
  location: { reference: 'meung', label: 'Meung-sur-Loire' },
  period: 'dusk',
  activeQuests: [],
  pendingTurn: null,
}

/** The visible text, tags dropped. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('SceneTag', () => {
  test('tells where and when the scene is, and nothing finer', () => {
    const text = textOf(renderToStaticMarkup(<SceneTag game={GAME} />))

    expect(text).toContain('Meung-sur-Loire')
    expect(text).toContain('Dusk')
    expect(text).not.toMatch(/\d{1,2}:\d{2}/)
  })

  test('names each part for screen readers', () => {
    const markup = renderToStaticMarkup(<SceneTag game={GAME} />)

    expect(markup).toContain('<span class="sr-only">Location: </span>')
    expect(markup).toContain('<span class="sr-only">, Time of day: </span>')
  })

  test('then says which world and which scenario', () => {
    const text = textOf(renderToStaticMarkup(<SceneTag game={GAME} />))

    expect(text).toContain('The Three Musketeers · A Gascon in Paris')
  })

  test('an unknown place is said so', () => {
    const text = textOf(renderToStaticMarkup(<SceneTag game={{ ...GAME, location: null }} />))

    expect(text).toContain('Unknown')
  })
})
