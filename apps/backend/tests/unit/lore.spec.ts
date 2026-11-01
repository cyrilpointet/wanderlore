import { test } from '@japa/runner'

import type { ItemsInScene } from '#services/game/inventory'
import type { LoreFragmentContent, WorldDefinition } from '#services/game/world'
import {
  TAGGED_LORE_CAP,
  type LoreScene,
  loreFor,
  loreSceneOf,
  placesOf,
} from '#services/game/lore'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'

function fragment(
  reference: string,
  tags: string[] = [],
  rest: Partial<LoreFragmentContent> = {}
): LoreFragmentContent {
  return { reference, kind: 'fact', content: `About ${reference}.`, tags, secret: false, ...rest }
}

/** The Musketeers' places and people, with the lore of a spec. */
function worldWith(lore: LoreFragmentContent[]): WorldDefinition {
  return { ...THREE_MUSKETEERS, lore }
}

function referencesOf(fragments: LoreFragmentContent[]): string[] {
  return fragments.map(({ reference }) => reference)
}

const NOTHING: ItemsInScene = { character: [], npcs: [], location: [] }

/** In the courtyard of Tréville's hôtel, in Paris, in France. */
const AT_TREVILLE: LoreScene = {
  places: ['hotel_de_treville', 'paris', 'france'],
  npcs: [],
  items: [],
}

test.group('Lore | what the scene holds', () => {
  test('a named place stands in its parents, the closest first', ({ assert }) => {
    assert.deepEqual(
      placesOf(THREE_MUSKETEERS, {
        definitionReference: 'hotel_de_treville',
        parentReference: null,
      }),
      ['hotel_de_treville', 'paris', 'france']
    )
  })

  test('an improvised place stands in the named place it was set in, and beyond', ({ assert }) => {
    assert.deepEqual(
      placesOf(THREE_MUSKETEERS, { definitionReference: 'tavern', parentReference: 'paris' }),
      ['tavern', 'paris', 'france']
    )
  })

  test('a loop written by hand stops at the place seen twice', ({ assert }) => {
    const looped: WorldDefinition = {
      ...THREE_MUSKETEERS,
      locations: THREE_MUSKETEERS.locations.map((location) =>
        location.reference === 'france' && location.kind === 'unique'
          ? { ...location, parent: 'paris' }
          : location
      ),
    }

    assert.deepEqual(placesOf(looped, { definitionReference: 'paris', parentReference: null }), [
      'paris',
      'france',
    ])
  })

  test('the scene gives its place, who is present and the items, by definition', ({ assert }) => {
    const held = (definition: string) => ({
      handle: null,
      definition,
      descriptor: null,
      quantity: 1,
      equipped: false,
    })

    const scene = loreSceneOf(THREE_MUSKETEERS, {
      place: { definitionReference: 'hotel_de_treville', parentReference: null },
      npc_definitions: { treville: 'treville', royal_guard_1: 'royal_guard' },
      items: {
        character: [held('letter_to_treville')],
        npcs: [{ handle: 'royal_guard_1', items: [held('musket')] }],
        location: [held('rope')],
      },
    })

    assert.deepEqual(scene, {
      places: ['hotel_de_treville', 'paris', 'france'],
      npcs: ['treville', 'royal_guard'],
      items: ['letter_to_treville', 'musket', 'rope'],
    })
  })

  test('an arrival adds where it ends, and who waits there', ({ assert }) => {
    const scene = loreSceneOf(
      THREE_MUSKETEERS,
      {
        place: { definitionReference: 'rue_des_fossoyeurs', parentReference: null },
        npc_definitions: {},
        items: NOTHING,
      },
      { destination: 'louvre', npcs: ['athos'] }
    )

    /** Both places before what contains them. */
    assert.deepEqual(scene.places.slice(0, 2), ['rue_des_fossoyeurs', 'louvre'])
    assert.includeMembers(scene.places, ['paris', 'france'])
    assert.deepEqual(scene.npcs, ['athos'])
  })
})

test.group('Lore | what each step is sent', () => {
  test('a fragment without tags always goes; a tagged one only when the scene holds a tag', ({
    assert,
  }) => {
    const world = worldWith([
      fragment('always'),
      fragment('in_paris', ['paris']),
      fragment('in_london', ['london']),
    ])

    assert.deepEqual(referencesOf(loreFor(world, 'arbitration', AT_TREVILLE)), [
      'always',
      'in_paris',
    ])
  })

  test('arbitration gets rules and facts, the narration ambiance and facts', ({ assert }) => {
    const world = worldWith([
      fragment('rule', [], { kind: 'rule' }),
      fragment('ambiance', [], { kind: 'ambiance' }),
      fragment('fact', [], { kind: 'fact' }),
    ])

    assert.deepEqual(referencesOf(loreFor(world, 'arbitration', AT_TREVILLE)), ['rule', 'fact'])
    assert.deepEqual(referencesOf(loreFor(world, 'narration', AT_TREVILLE)), ['ambiance', 'fact'])
  })

  test('a secret reaches arbitration, never the narration', ({ assert }) => {
    const world = worldWith([fragment('debts', ['paris'], { secret: true })])

    assert.deepEqual(referencesOf(loreFor(world, 'arbitration', AT_TREVILLE)), ['debts'])
    assert.isEmpty(loreFor(world, 'narration', AT_TREVILLE))
  })

  test('the most specific first: the place, its parents, the people, the items', ({ assert }) => {
    const world = worldWith([
      fragment('a_rope', ['rope']),
      fragment('a_guard', ['royal_guard']),
      fragment('france', ['france']),
      fragment('paris', ['paris']),
      fragment('the_courtyard', ['hotel_de_treville']),
      fragment('always'),
    ])
    const scene = { ...AT_TREVILLE, npcs: ['royal_guard'], items: ['rope'] }

    assert.deepEqual(referencesOf(loreFor(world, 'narration', scene)), [
      'always',
      'the_courtyard',
      'paris',
      'france',
      'a_guard',
      'a_rope',
    ])
  })

  test('a fragment ranks by its most specific tag', ({ assert }) => {
    const world = worldWith([fragment('france', ['france']), fragment('both', ['france', 'paris'])])

    assert.deepEqual(referencesOf(loreFor(world, 'narration', AT_TREVILLE)), ['both', 'france'])
  })

  test('past the cap, the least specific are left out — never those without tags', ({ assert }) => {
    const parisian = Array.from({ length: TAGGED_LORE_CAP }, (_, index) =>
      fragment(`paris_${index}`, ['paris'])
    )
    const world = worldWith([
      fragment('france', ['france']),
      ...parisian,
      fragment('always_1'),
      fragment('always_2'),
    ])

    const sent = referencesOf(loreFor(world, 'arbitration', AT_TREVILLE))

    assert.lengthOf(sent, TAGGED_LORE_CAP + 2)
    assert.includeMembers(sent, ['always_1', 'always_2'])
    assert.notInclude(sent, 'france')
  })

  test('the seeded worlds send their rules and ambiance with every turn', ({ assert }) => {
    const nowhere: LoreScene = { places: [], npcs: [], items: [] }

    assert.deepEqual(
      loreFor(THREE_MUSKETEERS, 'arbitration', nowhere).map(({ kind }) => kind),
      THREE_MUSKETEERS.lore.filter(({ kind }) => kind === 'rule').map(() => 'rule')
    )
    assert.isNotEmpty(loreFor(THREE_MUSKETEERS, 'narration', nowhere))
  })
})
