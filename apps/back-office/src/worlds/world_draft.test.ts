import { describe, expect, test } from 'vitest'

import type { WorldDetail } from './queries'
import { worldDraftFromJson, worldDraftOf, worldPayloadOf, worldUpdateOf } from './world_draft'

const WORLD: WorldDetail = {
  id: 'w1',
  reference: 'three_musketeers',
  labels: { en: 'The Three Musketeers', fr: 'Les Trois Mousquetaires' },
  narrativeTone: 'France, 1625.',
  skills: [
    { reference: 'swordsmanship', labels: { en: 'Swordsmanship' }, category: 'combat', baseChance: 15 },
    {
      reference: 'dodge',
      labels: { en: 'Dodge' },
      category: 'physical',
      baseChance: { characteristic: 'DEX', multiplier: 2 },
    },
  ],
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
  })

  test('holds a base chance as typed, and sends it as a number or a characteristic', () => {
    const draft = worldDraftOf(WORLD)

    expect(draft.skills.map(({ baseCharacteristic, baseValue }) => [baseCharacteristic, baseValue]))
      .toEqual([
        ['', '15'],
        ['DEX', '2'],
      ])

    const fixed = { ...draft.skills[1]!, baseCharacteristic: '' as const, baseValue: '25' }
    expect(worldPayloadOf({ ...draft, skills: [fixed] }).skills[0]!.baseChance).toBe(25)
  })
})

describe('world update', () => {
  test('never sends the reference of a saved world', () => {
    expect(worldUpdateOf(worldDraftOf(WORLD))).not.toHaveProperty('reference')
  })
})

describe('world from a JSON file', () => {
  test('sends back what the file held, as a new world', () => {
    const payload = Object.fromEntries(
      Object.entries(WORLD).filter(([key]) => key !== 'id' && key !== 'updatedAt')
    )
    const draft = worldDraftFromJson({ ...payload, actionTypes: [], scenarios: [] })

    expect(worldPayloadOf(draft)).toEqual(payload)
    expect(draft.skills.every(({ locked }) => !locked)).toBe(true)
  })

  test('leaves empty what is not of the right type, and keeps a new skill’s defaults', () => {
    const draft = worldDraftFromJson({
      reference: 42,
      labels: { fr: 'Monde', de: 7 },
      skills: [{ reference: 'luck', category: 'mystic', baseChance: { characteristic: 'XYZ' } }, 'x'],
    })

    expect(draft.reference).toBe('')
    expect(draft.labels).toEqual([
      { language: 'en', name: '' },
      { language: 'fr', name: 'Monde' },
    ])
    expect(draft.skills).toHaveLength(1)
    expect(draft.skills[0]).toMatchObject({
      reference: 'luck',
      category: 'physical',
      baseCharacteristic: '',
      baseValue: '5',
    })
  })
})
