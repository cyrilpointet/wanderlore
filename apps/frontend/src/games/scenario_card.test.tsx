import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ScenarioCard } from './scenario_card'
import type { ScenarioSummary } from './queries'

const PUBLISHED: ScenarioSummary = {
  id: 'f1d3c1e2-0000-4000-8000-000000000001',
  title: 'A Gascon in Paris',
  synopsis: "Young d'Artagnan leaves Gascony for Paris.",
  status: 'published',
  world: {
    reference: 'three_musketeers',
    label: 'The Three Musketeers',
    tone: 'Cloak-and-dagger adventure.',
  },
}

function render(scenario: ScenarioSummary, state: { starting?: boolean; disabled?: boolean } = {}) {
  return renderToStaticMarkup(
    <ScenarioCard
      scenario={scenario}
      starting={state.starting ?? false}
      disabled={state.disabled ?? false}
      onStart={() => {}}
    />
  )
}

describe('ScenarioCard', () => {
  test('shows the world, the title, the tone and the synopsis the backend sent', () => {
    const html = render(PUBLISHED)

    for (const text of [
      'The Three Musketeers',
      'A Gascon in Paris',
      'Cloak-and-dagger adventure.',
      'Young d&#x27;Artagnan leaves Gascony for Paris.',
      'Play',
    ]) {
      expect(html).toContain(text)
    }
  })

  test('marks a draft, which only a game master is shown', () => {
    expect(render({ ...PUBLISHED, status: 'draft' })).toContain('Draft')
    expect(render(PUBLISHED)).not.toContain('Draft')
  })

  test('says the game is starting, and lets nothing else start meanwhile', () => {
    const html = render(PUBLISHED, { starting: true, disabled: true })

    expect(html).toContain('Starting…')
    expect(html).toContain('disabled')
  })
})
