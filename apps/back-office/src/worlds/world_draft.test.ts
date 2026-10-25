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
