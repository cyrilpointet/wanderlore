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
  startingKit: { items: [], resources: {} },
  initialState: null,
  startTime: '16:00',
  startDate: '1927-10-28',
  glossary: [],
  flags: [],
  events: [],
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
      uniqueNpcs={['silas_ward', 'martha_pike']}
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

  test('ticks the names the character knows from the start, among the named people', () => {
    const html = render({
      ...SCENARIO,
      initialState: {
        location: 'ward_house_entrance_hall',
        chapter: null,
        quests: [],
        knownNpcs: ['silas_ward'],
      },
    })

    expect(html).toContain('Names known from the start')
    expect(html).toMatch(/<input type="checkbox" checked=""\/><span class="font-mono">silas_ward/)
    expect(html).toMatch(/<input type="checkbox"\/><span class="font-mono">martha_pike/)
  })
})

describe('ScenarioForm | starting kit', () => {
  test('shows the kit as JSON, with no pregenerated character left', () => {
    const html = render({
      ...SCENARIO,
      startingKit: {
        items: [{ definition: 'ward_letter', descriptor: null, quantity: 1, equipped: false }],
        resources: { dollars: 20 },
      },
    })

    expect(html).toContain('Starting kit')
    expect(html).toContain('ward_letter')
    expect(html).toContain('dollars')
    expect(html).not.toContain('Pregenerated')
    expect(html).not.toContain('scenario-character')
  })

  test('shows what the backend refused in the kit on its field', () => {
    const html = render(SCENARIO, {
      'startingKit.items.0.definition': '“ward_lamp” is no item of this world.',
    })

    expect(html).toMatch(/scenario-kit-items[\s\S]*“ward_lamp” is no item of this world\.[\s\S]*scenario-kit-resources/)
  })
})

describe('ScenarioForm | creation', () => {
  test('the reference is written only before the scenario is created', () => {
    const saved = render(SCENARIO)
    const created = renderToStaticMarkup(
      <ScenarioForm
        reference=""
        onReferenceChange={() => {}}
        draft={scenarioDraftOf(SCENARIO)}
        onChange={() => {}}
        errors={{ reference: 'This reference is already taken.' }}
        uniqueLocations={[]}
        uniqueNpcs={[]}
      />
    )

    expect(saved).toMatch(/id="scenario-reference"[^>]*disabled=""/)
    expect(created).not.toMatch(/id="scenario-reference"[^>]*disabled=""/)
    expect(created).toContain('This reference is already taken.')
  })
})
