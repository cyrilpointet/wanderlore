import { describe, expect, test } from 'vitest'

import type { WorldDetail } from './queries'
import { worldDraftOf, worldPayloadOf, worldUpdateOf } from './world_draft'

const WORLD: WorldDetail = {
  id: 'w1',
  reference: 'three_musketeers',
  labels: { en: 'The Three Musketeers', fr: 'Les Trois Mousquetaires' },
  narrativeTone: 'France, 1625.',
  rules: ['No magic.'],
  ambiance: ['Mud and torchlight.'],
  attributes: [{ reference: 'physical', labels: { en: 'Physical' } }],
  skills: [{ reference: 'swordsmanship', labels: { en: 'Swordsmanship' }, attribute: 'physical' }],
  resources: [{ reference: 'purse', labels: { en: 'Purse' } }],
  glossary: [],
  updatedAt: null,
}

describe('world draft', () => {
  test('sends back what it was given, untouched', () => {
    const payload = Object.fromEntries(
      Object.entries(WORLD).filter(([key]) => key !== 'id' && key !== 'updatedAt')
    )

    expect(worldPayloadOf(worldDraftOf(WORLD))).toEqual(payload)
  })

  test('locks the references already saved', () => {
    const draft = worldDraftOf(WORLD)

    expect(draft.skills[0]!.locked).toBe(true)
    expect(draft.attributes[0]!.locked).toBe(true)
  })

  test('drops blank phrases and trims the rest', () => {
    const draft = { ...worldDraftOf(WORLD), rules: ['  No magic.  ', ' ', ''] }

    expect(worldPayloadOf(draft).rules).toEqual(['No magic.'])
  })
})

describe('world update', () => {
  test('never sends the reference of a saved world', () => {
    expect(worldUpdateOf(worldDraftOf(WORLD))).not.toHaveProperty('reference')
  })
})
