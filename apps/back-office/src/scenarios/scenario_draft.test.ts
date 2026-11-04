import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { Scenario } from './queries'
import { scenarioDraftFromJson, scenarioDraftOf, scenarioUpdateOf } from './scenario_draft'

const SCENARIO: Scenario = {
  id: 's1',
  worldId: 'w1',
  reference: 'a_gascon_in_paris',
  labels: { en: 'A Gascon in Paris' },
  synopsis: '1625.',
  status: 'draft',
  chapters: [{ reference: 'the_road_to_paris', labels: { en: 'The Road to Paris' } }],
  quests: [{ reference: 'deliver_the_letter', labels: { en: 'Deliver the letter' } }],
  startingKit: {
    items: [
      {
        definition: 'letter_of_introduction',
        descriptor: 'for Monsieur de Tréville',
        quantity: 1,
        equipped: false,
      },
    ],
    resources: { purse: 5 },
  },
  initialState: {
    location: 'meung_sur_loire',
    chapter: 'the_road_to_paris',
    quests: [{ reference: 'deliver_the_letter', step: 1, summary: 'Carry the letter.' }],
    knownNpcs: ['treville'],
  },
  startTime: '10:00',
  startDate: '1625-04-07',
  glossary: [],
  flags: [{ reference: 'letter_delivered', description: 'The letter reached Tréville.' }],
  events: [],
  updatedAt: null,
}

describe('scenario draft', () => {
  test('sends back what it was given, untouched', () => {
    expect(scenarioUpdateOf(scenarioDraftOf(SCENARIO))).toEqual({
      payload: {
        labels: SCENARIO.labels,
        synopsis: SCENARIO.synopsis,
        chapters: SCENARIO.chapters,
        quests: SCENARIO.quests,
        glossary: [],
        startingKit: SCENARIO.startingKit,
        initialState: SCENARIO.initialState,
        startTime: '10:00',
        startDate: '1625-04-07',
        flags: SCENARIO.flags,
        events: [],
      },
    })
  })

  test('names flags or events that are not valid JSON, and sends nothing', () => {
    const draft = { ...scenarioDraftOf(SCENARIO), flags: '[', events: '{' }

    expect(scenarioUpdateOf(draft)).toEqual({
      errors: { flags: 'This is not valid JSON.', events: 'This is not valid JSON.' },
    })
  })

  test('a state written before names were known starts knowing none', () => {
    const older = { ...SCENARIO.initialState!, knownNpcs: undefined }
    const update = scenarioUpdateOf(scenarioDraftOf({ ...SCENARIO, initialState: older }))

    expect(update.payload?.initialState).toMatchObject({ knownNpcs: [] })
  })

  test('a story with no date sends none', () => {
    const draft = { ...scenarioDraftOf({ ...SCENARIO, startDate: null }) }

    expect(draft.startDate).toBe('')
    expect(scenarioUpdateOf(draft).payload).toMatchObject({ startTime: '10:00', startDate: null })
  })

  test('no starting place, no initial state; an empty kit gives nothing', () => {
    const draft = {
      ...scenarioDraftOf(SCENARIO),
      startLocation: '',
      kitItems: ' ',
      kitResources: '',
    }

    expect(scenarioUpdateOf(draft).payload).toMatchObject({
      initialState: null,
      startingKit: { items: [], resources: {} },
    })
  })

  test('names a kit that is not valid JSON on its field, as the backend names it', () => {
    const draft = { ...scenarioDraftOf(SCENARIO), kitItems: '[{ definition: ', kitResources: '{' }

    expect(scenarioUpdateOf(draft)).toEqual({
      errors: {
        'startingKit.items': 'This is not valid JSON.',
        'startingKit.resources': 'This is not valid JSON.',
      },
    })
  })

  test('never sends a pregenerated character', () => {
    expect(scenarioUpdateOf(scenarioDraftOf(SCENARIO)).payload).not.toHaveProperty(
      'pregeneratedCharacter'
    )
  })
})

describe('scenario from a JSON file', () => {
  test('sends back what the file held, its reference apart, catalogues left out', () => {
    const notSent = ['id', 'worldId', 'status', 'updatedAt', 'reference']
    const rest = Object.fromEntries(
      Object.entries(SCENARIO).filter(([key]) => !notSent.includes(key))
    )
    const read = scenarioDraftFromJson({ ...SCENARIO, npcs: [{ reference: 'treville' }] })

    expect(read.reference).toBe(SCENARIO.reference)
    expect(scenarioUpdateOf(read.draft).payload).toEqual(rest)
    expect(read.draft.chapters.every(({ locked }) => !locked)).toBe(true)
  })

  test('a file with little in it opens like an empty scenario', () => {
    const { reference, draft } = scenarioDraftFromJson({ labels: { en: 'The Stolen Seal' } })

    expect(reference).toBe('')
    expect(draft).toMatchObject({
      synopsis: '',
      kitItems: '[]',
      kitResources: '{}',
      startLocation: '',
      startKnownNpcs: [],
      startTime: '08:00',
      startDate: '',
    })
    expect(scenarioUpdateOf(draft).payload).toMatchObject({
      initialState: null,
      startingKit: { items: [], resources: {} },
    })
  })

  test('a kit of the wrong shape is left empty; a pregenerated character is left out', () => {
    const { draft } = scenarioDraftFromJson({
      labels: { en: 'The Stolen Seal' },
      startingKit: { items: { definition: 'seal' }, resources: ['purse'] },
      pregeneratedCharacter: { name: "d'Artagnan" },
    })

    expect(scenarioUpdateOf(draft).payload).toMatchObject({
      startingKit: { items: [], resources: {} },
    })
    expect(scenarioUpdateOf(draft).payload).not.toHaveProperty('pregeneratedCharacter')
  })
})
