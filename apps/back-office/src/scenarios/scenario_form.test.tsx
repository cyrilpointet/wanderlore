import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { ScenarioForm } from './scenario_form'
import { scenarioDraftOf } from './scenario_draft'
import type { Scenario } from './queries'

const SCENARIO: Scenario = {
  id: 's1',
  worldId: 'w1',
  reference: 'the_ward_inheritance',
  labels: { en: 'The Ward Inheritance' },
  synopsis: 'New England, 1927.',
  status: 'draft',
  chapters: [],
  quests: [],
  pregeneratedCharacter: null,
  initialState: null,
  startTime: '16:00',
  startDate: '1927-10-28',
  glossary: [],
  updatedAt: null,
}

function render(scenario: Scenario, errors = {}) {
  return renderToStaticMarkup(
    <ScenarioForm
      reference={scenario.reference}
      draft={scenarioDraftOf(scenario)}
      onChange={() => {}}
      errors={errors}
      uniqueLocations={['ward_house_entrance_hall']}
    />
  )
}

describe('ScenarioForm', () => {
  test('says when the story opens: a time of day, always, and a date', () => {
    const html = render(SCENARIO)

    expect(html).toContain('Time of day')
    expect(html).toMatch(/type="time"[^>]*required=""[^>]*value="16:00"/)
    expect(html).toMatch(/type="date"[^>]*value="1927-10-28"/)
  })

  test('a story with no date leaves the date empty', () => {
    expect(render({ ...SCENARIO, startDate: null })).toMatch(/type="date"[^>]*value=""/)
  })

  test('shows what the backend refused on its field', () => {
    expect(render(SCENARIO, { startTime: 'The startTime field format is invalid' })).toContain(
      'The startTime field format is invalid'
    )
  })
})
