import { describe, expect, test } from 'vitest'

import '@/i18n'
import { definitionDraftOf, definitionPayloadOf, emptyDefinitionDraft } from './definition_draft'
import type { ItemDefinition, LocationDefinition, NpcDefinition } from './queries'

const SHARED = {
  id: 'd1',
  worldId: 'w1',
  scenarioId: null,
  labels: { en: 'Athos', fr: 'Athos' },
  description: 'A musketeer.',
  updatedAt: null,
}

const ATHOS: NpcDefinition = {
  ...SHARED,
  reference: 'athos',
  kind: 'unique',
  generic: false,
  defaultDisposition: 'neutral',
  combat: { skills: { swordsmanship: 90 }, hitPointsMax: 14, weapon: 'rapier' },
}

const STUDS: ItemDefinition = {
  ...SHARED,
  reference: 'studs',
  kind: 'unique',
  generic: false,
  stackable: false,
  equippable: false,
  modifiers: [],
  weapon: null,
  initialHolder: { holder: 'npc', reference: 'buckingham' },
}

describe('definition draft', () => {
  test('sends a person back as it came, the reference only when creating', () => {
    const draft = definitionDraftOf(ATHOS)

    expect(definitionPayloadOf('npcs', draft, { creating: false })).toEqual({
      payload: {
        labels: ATHOS.labels,
        description: ATHOS.description,
        kind: 'unique',
        generic: false,
        defaultDisposition: 'neutral',
        combat: ATHOS.combat,
      },
    })
    expect(definitionPayloadOf('npcs', draft, { creating: true }).payload).toHaveProperty(
      'reference',
      'athos'
    )
  })

  test('keeps an item’s initial holder through the draft', () => {
    expect(definitionPayloadOf('items', definitionDraftOf(STUDS), { creating: false }).payload)
      .toMatchObject({ initialHolder: { holder: 'npc', reference: 'buckingham' } })
  })

  test('leaves out what only the other kind may have', () => {
    const tavern: LocationDefinition = {
      ...SHARED,
      reference: 'tavern',
      kind: 'archetype',
      parent: null,
    }
    const draft = { ...definitionDraftOf(tavern), parent: 'paris' }
    const unique = { ...definitionDraftOf(STUDS), generic: true, stackable: true }

    expect(definitionPayloadOf('locations', draft, { creating: false }).payload).toMatchObject({
      parent: null,
    })
    expect(definitionPayloadOf('items', unique, { creating: false }).payload).toMatchObject({
      generic: false,
      stackable: false,
    })
    expect(
      definitionPayloadOf('items', { ...unique, kind: 'archetype' }, { creating: false }).payload
    ).toMatchObject({ initialHolder: null })
  })

  test('sends a weapon profile as written, and no weapon for an empty field', () => {
    const rapier: ItemDefinition = {
      ...STUDS,
      reference: 'rapier',
      kind: 'archetype',
      equippable: true,
      initialHolder: null,
      weapon: { skill: 'swordsmanship', damage: '1D6+1', damageModifier: 'full', special: 'impaling' },
    }

    expect(
      definitionPayloadOf('items', definitionDraftOf(rapier), { creating: false }).payload
    ).toMatchObject({ weapon: rapier.weapon })
    expect(
      definitionPayloadOf('items', definitionDraftOf(STUDS), { creating: false }).payload
    ).toMatchObject({ weapon: null })
    expect(
      definitionPayloadOf('items', { ...definitionDraftOf(STUDS), weapon: '{ skill' }, {
        creating: false,
      })
    ).toEqual({ errors: { weapon: 'This is not valid JSON.' } })
  })

  test('names JSON that does not parse, and sends nothing', () => {
    const draft = { ...emptyDefinitionDraft(), combat: '{ skills: ' }

    expect(definitionPayloadOf('npcs', draft, { creating: true })).toEqual({
      errors: { combat: 'This is not valid JSON.' },
    })
  })
})

describe('definition draft of a place', () => {
  const HALL: LocationDefinition = {
    ...SHARED,
    reference: 'house_hall',
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
  }

  test('sends its exits as written, and whether it is an entrance', () => {
    expect(
      definitionPayloadOf('locations', definitionDraftOf(HALL), { creating: false }).payload
    ).toMatchObject({ parent: 'house', exits: HALL.exits, entrance: true })
  })

  test('an archetype has no exit and is no entrance', () => {
    const draft = { ...definitionDraftOf(HALL), kind: 'archetype' as const }

    expect(definitionPayloadOf('locations', draft, { creating: false }).payload).toMatchObject({
      parent: null,
      exits: [],
      entrance: false,
    })
  })

  test('names exits that are not valid JSON, and sends nothing', () => {
    const draft = { ...definitionDraftOf(HALL), exits: '[{ to: ' }

    expect(definitionPayloadOf('locations', draft, { creating: false })).toEqual({
      errors: { exits: 'This is not valid JSON.' },
    })
  })
})
