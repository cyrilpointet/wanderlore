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
  powerLevel: 'epic',
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

describe('WorldForm | power level', () => {
  test('picks the level among the four of BRP, the saved one selected', () => {
    const html = renderToStaticMarkup(
      <WorldForm draft={worldDraftOf(WORLD)} onChange={() => {}} errors={{}} creating={false} />
    )

    expect(html).toContain('Power level')
    for (const level of ['Normal', 'Heroic', 'Epic', 'Superhuman']) {
      expect(html).toContain(level)
    }
    expect(html).toMatch(/<option value="epic" selected="">Epic<\/option>/)
  })

  test('is asked on creation too, with the names and tone', () => {
    const html = renderToStaticMarkup(
      <WorldForm draft={worldDraftOf(WORLD)} onChange={() => {}} errors={{}} creating />
    )

    expect(html).toContain('world-power-level')
  })
})

describe('WorldForm | creation', () => {
  test('asks only for names and tone, unless the world comes whole from a file', () => {
    const draft = worldDraftOf(WORLD)
    const plain = renderToStaticMarkup(
      <WorldForm draft={draft} onChange={() => {}} errors={{}} creating />
    )
    const full = renderToStaticMarkup(
      <WorldForm draft={draft} onChange={() => {}} errors={{}} creating full />
    )

    expect(plain).not.toContain('Skills')
    expect(full).toContain('Skills')
    expect(full).not.toMatch(/id="world-reference"[^>]*disabled=""/)
  })
})
