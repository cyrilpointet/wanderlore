import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { DefinitionForm } from './definition_form'
import { definitionDraftOf } from './definition_draft'
import type { LocationDefinition } from './queries'

const HALL: LocationDefinition = {
  id: 'd1',
  worldId: 'w1',
  scenarioId: null,
  reference: 'house_hall',
  labels: { en: 'The hall' },
  description: 'A tall hall.',
  kind: 'unique',
  parent: 'house',
  entrance: true,
  exits: [
    {
      to: 'house_study',
      passage: 'a locked oak door',
      backPassage: null,
      hidden: false,
      requires: 'iron_key',
      oneWay: false,
      duration: null,
    },
  ],
  updatedAt: null,
}

function render(definition: LocationDefinition) {
  return renderToStaticMarkup(
    <DefinitionForm
      catalogue="locations"
      draft={definitionDraftOf(definition)}
      onChange={() => {}}
      errors={{}}
      idPrefix="place"
      creating={false}
      lists={{ uniqueNpcs: [], uniqueLocations: ['house'] }}
    />
  )
}

describe('DefinitionForm of a place', () => {
  test('a named place shows its exits as JSON, and whether it is an entrance', () => {
    const html = render(HALL)

    expect(html).toContain('Exits')
    expect(html).toContain('a locked oak door')
    expect(html).toMatch(/id="place-entrance"[^>]*checked=""/)
  })

  test('an archetype has neither', () => {
    const html = render({ ...HALL, kind: 'archetype', parent: null })

    expect(html).not.toContain('place-exits')
    expect(html).not.toContain('place-entrance')
  })
})
