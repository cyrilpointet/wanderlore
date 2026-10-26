import { describe, expect, test } from 'vitest'

import '@/i18n'
import type { Scenario } from './queries'
import { scenarioDraftOf, scenarioUpdateOf } from './scenario_draft'

const SCENARIO: Scenario = {
  id: 's1',
  worldId: 'w1',
  reference: 'a_gascon_in_paris',
  labels: { en: 'A Gascon in Paris' },
  synopsis: '1625.',
  status: 'draft',
  chapters: [{ reference: 'the_road_to_paris', labels: { en: 'The Road to Paris' } }],
  quests: [{ reference: 'deliver_the_letter', labels: { en: 'Deliver the letter' } }],
  pregeneratedCharacter: {
    name: "d'Artagnan",
    characteristics: { STR: 13, CON: 14, SIZ: 12, INT: 13, POW: 12, DEX: 16, CHA: 14 },
  },
  initialState: {
    location: 'meung_sur_loire',
    chapter: 'the_road_to_paris',
    quests: [{ reference: 'deliver_the_letter', step: 1, summary: 'Carry the letter.' }],
  },
  startTime: '10:00',
  startDate: '1625-04-07',
  glossary: [],
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
        pregeneratedCharacter: SCENARIO.pregeneratedCharacter,
        initialState: SCENARIO.initialState,
        startTime: '10:00',
        startDate: '1625-04-07',
      },
    })
  })

  test('a story with no date sends none', () => {
    const draft = { ...scenarioDraftOf({ ...SCENARIO, startDate: null }) }

    expect(draft.startDate).toBe('')
    expect(scenarioUpdateOf(draft).payload).toMatchObject({ startTime: '10:00', startDate: null })
  })

  test('no starting place, no initial state; no character text, no character', () => {
    const draft = { ...scenarioDraftOf(SCENARIO), startLocation: '', pregeneratedCharacter: ' ' }

    expect(scenarioUpdateOf(draft).payload).toMatchObject({
      initialState: null,
      pregeneratedCharacter: null,
    })
  })

  test('names a character that is not valid JSON, and sends nothing', () => {
    const draft = { ...scenarioDraftOf(SCENARIO), pregeneratedCharacter: '{ name: ' }

    expect(scenarioUpdateOf(draft)).toEqual({
      errors: { pregeneratedCharacter: 'This is not valid JSON.' },
    })
  })
})
