import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { WorldDetail } from './queries'
import { worldDraftOf } from './world_draft'
import { WorldForm } from './world_form'

const WORLD: WorldDetail = {
  id: 'w1',
  reference: 'three_musketeers',
  labels: { en: 'The Three Musketeers' },
  narrativeTone: 'France, 1625.',
  rules: [],
  ambiance: [],
  skills: [
    {
      reference: 'dodge',
      labels: { en: 'Dodge' },
      category: 'physical',
      baseChance: { characteristic: 'DEX', multiplier: 2 },
    },
  ],
  resources: [],
  glossary: [],
  updatedAt: null,
}

describe('WorldForm | skills', () => {
  test('edits a skill by its BRP category and base chance, with no attribute left', () => {
    const html = renderToStaticMarkup(
      <WorldForm draft={worldDraftOf(WORLD)} onChange={() => {}} errors={{}} creating={false} />
    )

    for (const text of ['Category', 'Physical', 'Base chance', 'Dexterity', 'Multiplier']) {
      expect(html).toContain(text)
    }
    expect(html).not.toContain('Attribute')
  })
})
