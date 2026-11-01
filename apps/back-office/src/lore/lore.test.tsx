import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { FragmentSummary } from './lore_editor'
import { emptyLoreDraft, loreDraftOf, lorePayloadOf } from './lore_draft'
import { LoreForm } from './lore_form'
import type { LoreFragment } from './queries'

const MILL: LoreFragment = {
  id: 'f1',
  worldId: 'w1',
  scenarioId: null,
  reference: 'the_mill',
  kind: 'fact',
  content: 'The Huguenots hold the mill and distrust anyone from Paris.',
  tags: ['the_mill', 'pastor'],
  secret: false,
  updatedAt: null,
}

const TAGS = { places: ['the_mill', 'the_village'], people: ['pastor'], items: [] }

describe('lore draft', () => {
  test('sends back what it was given, the reference only on creation', () => {
    const draft = loreDraftOf(MILL)

    expect(lorePayloadOf(draft, { creating: false })).toEqual({
      kind: 'fact',
      content: MILL.content,
      tags: MILL.tags,
      secret: false,
    })
    expect(lorePayloadOf(draft, { creating: true })).toHaveProperty('reference', 'the_mill')
  })

  test('a new fragment is a fact sent with every turn', () => {
    expect(emptyLoreDraft()).toMatchObject({ kind: 'fact', tags: [], secret: false })
  })

  test('never sends a secret ambiance', () => {
    const draft = { ...loreDraftOf({ ...MILL, secret: true }), kind: 'ambiance' as const }

    expect(lorePayloadOf(draft, { creating: false }).secret).toBe(false)
  })
})

describe('LoreForm', () => {
  function render(fragment: LoreFragment) {
    return renderToStaticMarkup(
      <LoreForm
        draft={loreDraftOf(fragment)}
        onChange={() => {}}
        errors={{}}
        idPrefix="fragment"
        creating={false}
        tags={TAGS}
      />
    )
  }

  test('ticks the tags of the fragment among every place, person and item', () => {
    const html = render(MILL)

    expect(html).toMatch(/id="fragment-places-the_mill"[^>]*checked/)
    expect(html).not.toMatch(/id="fragment-places-the_village"[^>]*checked/)
    expect(html).toMatch(/id="fragment-people-pastor"[^>]*checked/)
  })

  test('keeps a tag that names nothing anymore, to be unticked', () => {
    expect(render({ ...MILL, tags: ['the_old_mill'] })).toContain('the_old_mill')
  })

  test('an ambiance cannot be secret', () => {
    const html = render({ ...MILL, kind: 'ambiance' })

    expect(html).toMatch(/id="fragment-secret"[^>]*disabled/)
    expect(html).toContain('it cannot be secret')
  })
})

describe('FragmentSummary', () => {
  test('says what it holds, and when it is sent', () => {
    const html = renderToStaticMarkup(<FragmentSummary fragment={MILL} overrides={false} />)

    expect(html).toContain('The Huguenots hold the mill')
    expect(html).toContain('2 tags')
    expect(html).toContain('Fact')
  })

  test('a fragment without tags goes with every turn; a secret says so', () => {
    const html = renderToStaticMarkup(
      <FragmentSummary fragment={{ ...MILL, tags: [], secret: true }} overrides />
    )

    expect(html).toContain('Every turn')
    expect(html).toContain('Secret')
    expect(html).toContain('Overrides the world')
  })
})
