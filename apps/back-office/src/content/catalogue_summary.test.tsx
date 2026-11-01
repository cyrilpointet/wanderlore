import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { CatalogueSummary } from './catalogue_summary'
import { cataloguesOf, importedUniques, noCatalogues, worldContentOf } from './imports'

describe('imported catalogues', () => {
  test('keeps the entries of each catalogue a file carries, objects only', () => {
    const catalogues = cataloguesOf({
      reference: 'the_siege',
      locations: [{ reference: 'la_rochelle', kind: 'unique' }, 'x', 3],
      lore: [{ reference: 'the_mill' }],
      npcs: 'nobody',
    })

    expect(catalogues.locations).toEqual([{ reference: 'la_rochelle', kind: 'unique' }])
    expect(catalogues.lore).toHaveLength(1)
    expect(catalogues.npcs).toEqual([])
    expect(catalogues.items).toEqual([])
  })

  test('a world file also brings its categories of action', () => {
    const content = worldContentOf({
      actionTypes: [{ actionType: 'investigation', associatedSkill: 'deduction' }, null],
      lore: [{ reference: 'fog' }],
    })

    expect(content.actionTypes).toEqual([{ actionType: 'investigation', associatedSkill: 'deduction' }])
    expect(content.lore).toHaveLength(1)
  })

  test('names the unique ones, for the rest of the form', () => {
    expect(
      importedUniques([
        { reference: 'la_rochelle', kind: 'unique' },
        { reference: 'inn', kind: 'archetype' },
        { kind: 'unique' },
      ])
    ).toEqual(['la_rochelle'])
  })
})

describe('CatalogueSummary', () => {
  test('nothing to show when the file carries no catalogue', () => {
    expect(renderToStaticMarkup(<CatalogueSummary catalogues={noCatalogues()} errors={{}} />)).toBe(
      ''
    )
  })

  test('lists each entry by reference, with what the server found wrong in it', () => {
    const html = renderToStaticMarkup(
      <CatalogueSummary
        catalogues={{
          ...noCatalogues(),
          locations: [{ reference: 'la_rochelle' }],
          lore: [{ reference: 'the_mill' }, { reference: 'nowhere' }],
        }}
        errors={{ 'lore.1.tags': 'This tag names nothing.' }}
      />
    )

    expect(html).toContain('1 place')
    expect(html).toContain('2 lore fragments')
    expect(html).toContain('la_rochelle')
    expect(html).toContain('This tag names nothing.')
  })

  test('lists the categories of action of a world by their name', () => {
    const html = renderToStaticMarkup(
      <CatalogueSummary
        catalogues={{ ...noCatalogues(), actionTypes: [{ actionType: 'investigation' }] }}
        errors={{}}
      />
    )

    expect(html).toContain('1 category of action')
    expect(html).toContain('investigation')
  })
})
