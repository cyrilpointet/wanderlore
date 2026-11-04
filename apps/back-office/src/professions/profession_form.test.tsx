import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { emptyProfessionDraft, professionDraftOf } from './profession_draft'
import { ProfessionForm } from './profession_form'
import type { Profession } from './queries'

const MUSKETEER: Profession = {
  id: 'p1',
  worldId: 'w1',
  reference: 'musketeer',
  labels: { en: 'Musketeer' },
  description: 'A soldier of the King’s household.',
  skills: ['swordsmanship', 'brawl'],
  startingItems: [{ definition: 'rapier', descriptor: null, quantity: 1, equipped: true }],
  startingResources: { purse: 10 },
  updatedAt: null,
}

const SKILLS = [
  { reference: 'swordsmanship', name: 'Swordsmanship' },
  { reference: 'ride', name: 'Ride' },
]

function render(
  draft = professionDraftOf(MUSKETEER),
  { creating = false, errors = {} }: { creating?: boolean; errors?: Record<string, string> } = {}
) {
  return renderToStaticMarkup(
    <ProfessionForm
      draft={draft}
      onChange={() => {}}
      errors={errors}
      idPrefix="musketeer"
      creating={creating}
      skills={SKILLS}
    />
  )
}

describe('ProfessionForm', () => {
  test('ticks the skills it trains, among the world’s', () => {
    const html = render()

    expect(html).toContain('Professional skills')
    expect(html).toMatch(/checked=""[^>]*\/><span>Swordsmanship<\/span>/)
    expect(html).toMatch(/<input type="checkbox" class="[^"]*"\/><span>Ride<\/span>/)
  })

  test('keeps a skill the world no longer has, for the backend to name', () => {
    expect(render()).toMatch(/checked=""[^>]*\/><span>brawl<\/span>/)
  })

  test('shows its equipment and resources as JSON', () => {
    const html = render()

    expect(html).toContain('Starting equipment')
    expect(html).toContain('rapier')
    expect(html).toContain('Starting resources')
    expect(html).toContain('purse')
  })

  test('the reference is written only before the profession is created', () => {
    expect(render()).toMatch(/id="musketeer-reference"[^>]*disabled=""/)
    expect(render(emptyProfessionDraft(), { creating: true })).not.toMatch(
      /id="musketeer-reference"[^>]*disabled=""/
    )
  })

  test('shows what the backend refused on its field', () => {
    const html = render(professionDraftOf(MUSKETEER), {
      errors: {
        'skills': 'A skill named here is no skill of this world.',
        'startingItems.0.definition':
          'This item belongs to a scenario: a profession gives items of its world only.',
        'startingResources': 'A resource named here is no resource of this world.',
        'reference': 'This reference is already taken.',
      },
    })

    expect(html).toContain('A skill named here is no skill of this world.')
    expect(html).toContain('a profession gives items of its world only.')
    expect(html).toContain('A resource named here is no resource of this world.')
    expect(html).toContain('This reference is already taken.')
  })

  test('says when the world has no skill to train yet', () => {
    const html = renderToStaticMarkup(
      <ProfessionForm
        draft={emptyProfessionDraft()}
        onChange={() => {}}
        errors={{}}
        idPrefix="new"
        creating
        skills={[]}
      />
    )

    expect(html).toContain('The world has no skill yet')
  })
})
