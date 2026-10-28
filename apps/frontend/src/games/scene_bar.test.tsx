import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { Game } from './queries'
import { SceneBar } from './scene_bar'

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

describe('SceneBar', () => {
  test('tells where and when the scene is, and nothing finer', () => {
    const text = textOf(renderToStaticMarkup(<SceneBar game={GAME} />))

    expect(text).toContain('Meung-sur-Loire')
    expect(text).toContain('Dusk')
    expect(text).not.toMatch(/\d{1,2}:\d{2}/)
  })

  test('names each part for screen readers, the icons hidden', () => {
    const markup = renderToStaticMarkup(<SceneBar game={GAME} />)

    expect(markup).toContain('<dt class="sr-only">Location</dt>')
    expect(markup).toContain('<dt class="sr-only">Time of day</dt>')
    expect(markup.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(2)
  })

  test('an unknown place is said so', () => {
    const text = textOf(renderToStaticMarkup(<SceneBar game={{ ...GAME, location: null }} />))

    expect(text).toContain('Unknown')
  })
})
