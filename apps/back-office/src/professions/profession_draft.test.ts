import { describe, expect, test } from 'vitest'

import '@/i18n'
import { emptyProfessionDraft, professionDraftOf, professionPayloadOf } from './profession_draft'
import type { Profession } from './queries'

const MUSKETEER: Profession = {
  id: 'p1',
  worldId: 'w1',
  reference: 'musketeer',
  labels: { en: 'Musketeer', fr: 'Mousquetaire' },
  description: 'A soldier of the King’s household.',
  skills: ['swordsmanship', 'ride'],
  startingItems: [{ definition: 'rapier', descriptor: null, quantity: 1, equipped: true }],
  startingResources: { purse: 10 },
  updatedAt: null,
}

describe('profession draft', () => {
  test('sends a profession back as it came, the reference only when creating', () => {
    const draft = professionDraftOf(MUSKETEER)

    expect(professionPayloadOf(draft, { creating: false })).toEqual({
      payload: {
        labels: MUSKETEER.labels,
        description: MUSKETEER.description,
        skills: MUSKETEER.skills,
        startingItems: MUSKETEER.startingItems,
        startingResources: MUSKETEER.startingResources,
      },
    })
    expect(professionPayloadOf(draft, { creating: true }).payload).toHaveProperty(
      'reference',
      'musketeer'
    )
  })

  test('a new profession starts with nothing and sends nothing to start with', () => {
    const draft = { ...emptyProfessionDraft(), reference: ' priest ' }

    expect(professionPayloadOf(draft, { creating: true }).payload).toMatchObject({
      reference: 'priest',
      skills: [],
      startingItems: [],
      startingResources: {},
    })
  })

  test('an emptied JSON field means none', () => {
    const draft = { ...professionDraftOf(MUSKETEER), startingItems: ' ', startingResources: '' }

    expect(professionPayloadOf(draft, { creating: false }).payload).toMatchObject({
      startingItems: [],
      startingResources: {},
    })
  })

  test('names JSON that does not parse on its field, and sends nothing', () => {
    const draft = {
      ...professionDraftOf(MUSKETEER),
      startingItems: '[{ definition: ',
      startingResources: '{',
    }

    expect(professionPayloadOf(draft, { creating: false })).toEqual({
      errors: {
        startingItems: 'This is not valid JSON.',
        startingResources: 'This is not valid JSON.',
      },
    })
  })

  test('sends the equipment as written, for the backend to judge', () => {
    const draft = { ...professionDraftOf(MUSKETEER), startingItems: '{ "definition": "rapier" }' }

    expect(professionPayloadOf(draft, { creating: false }).payload).toMatchObject({
      startingItems: { definition: 'rapier' },
    })
  })
})
