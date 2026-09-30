import { test } from '@japa/runner'

import {
  THREE_MUSKETEERS,
  locationArchetypeReferences,
  npcReferences,
  uniqueLocationReferences,
  type ContentEntry,
  type LocationDefinition,
} from '#services/game/world'

const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

/**
 * One namespace per catalogue: unique places and place archetypes share one,
 * since a unique's handle is its bare reference and an archetype's is its
 * reference plus a number.
 */
const CONTENT: [string, ContentEntry[]][] = [
  ['attributes', THREE_MUSKETEERS.attributes],
  ['skills', THREE_MUSKETEERS.skills],
  ['resources', THREE_MUSKETEERS.resources],
  ['npcs', THREE_MUSKETEERS.npcs],
  ['locations', THREE_MUSKETEERS.locations],
  ['chapters', THREE_MUSKETEERS.chapters],
  ['quests', THREE_MUSKETEERS.quests],
]

test.group('World definition | content', () => {
  for (const [kind, entries] of CONTENT) {
    test(`every ${kind} entry has a stable reference and a label`, ({ assert }) => {
      for (const entry of entries) {
        assert.match(entry.reference, REFERENCE)
        assert.isNotEmpty(entry.label.trim())
      }
    })

    test(`${kind} references are unique`, ({ assert }) => {
      const references = entries.map((entry) => entry.reference)

      assert.lengthOf(new Set(references), references.length)
    })
  }

  test('every skill hangs off an attribute the world defines', ({ assert }) => {
    const attributes = THREE_MUSKETEERS.attributes.map((attribute) => attribute.reference)

    for (const skill of THREE_MUSKETEERS.skills) {
      assert.include(attributes, skill.attribute)
    }
  })
})

test.group('World definition | npcs', () => {
  test('every definition is described for the model', ({ assert }) => {
    for (const npc of THREE_MUSKETEERS.npcs) {
      assert.isNotEmpty(npc.description.trim(), npc.reference)
    }
  })

  test('declares generic archetypes for improvised people', ({ assert }) => {
    const generics = THREE_MUSKETEERS.npcs.filter((npc) => npc.kind === 'archetype' && npc.generic)

    assert.isNotEmpty(generics)
  })

  test('no unique character could be mistaken for an archetype instance', ({ assert }) => {
    /** Both share a game's handles: `treville`, but `cardinal_guard_2`. */
    const archetypes = THREE_MUSKETEERS.npcs.filter((npc) => npc.kind === 'archetype')

    for (const archetype of archetypes) {
      const handle = new RegExp(`^${archetype.reference}_\\d+$`)

      for (const npc of THREE_MUSKETEERS.npcs) {
        assert.notMatch(npc.reference, handle)
      }
    }
  })

  test('lists every definition in the closed list', ({ assert }) => {
    assert.sameMembers(
      npcReferences(THREE_MUSKETEERS),
      THREE_MUSKETEERS.npcs.map((npc) => npc.reference)
    )
  })
})

test.group('World definition | locations', () => {
  const uniques = THREE_MUSKETEERS.locations.filter(
    (location): location is Extract<LocationDefinition, { kind: 'unique' }> =>
      location.kind === 'unique'
  )
  const byReference = new Map(uniques.map((location) => [location.reference, location]))

  test('every definition is described for the model', ({ assert }) => {
    for (const location of THREE_MUSKETEERS.locations) {
      assert.isNotEmpty(location.description.trim(), location.reference)
    }
  })

  test('every parent is a unique place of the world', ({ assert }) => {
    for (const location of uniques) {
      if (location.parent !== null) {
        assert.isTrue(
          byReference.has(location.parent),
          `${location.reference} → ${location.parent}`
        )
      }
    }
  })

  test('the hierarchy has no loop', ({ assert }) => {
    for (const location of uniques) {
      const seen = new Set<string>()
      let current: string | null = location.reference

      while (current !== null) {
        assert.isFalse(seen.has(current), `loop through ${current}`)
        seen.add(current)
        current = byReference.get(current)?.parent ?? null
      }
    }
  })

  test('has large-scale roots to hang improvised places from', ({ assert }) => {
    const roots = uniques.filter((location) => location.parent === null)

    assert.includeMembers(
      roots.map((location) => location.reference),
      ['france', 'england']
    )
  })

  test('no unique place could be mistaken for an improvised one', ({ assert }) => {
    /**
     * Both share a game's handles: a unique place is its bare reference, an
     * improvised one its archetype plus a number (`road_1`).
     */
    for (const archetype of locationArchetypeReferences(THREE_MUSKETEERS)) {
      const handle = new RegExp(`^${archetype}_\\d+$`)

      for (const unique of uniqueLocationReferences(THREE_MUSKETEERS)) {
        assert.notMatch(unique, handle)
      }
    }
  })

  test('splits the catalogue into unique places and archetypes', ({ assert }) => {
    const unique = uniqueLocationReferences(THREE_MUSKETEERS)
    const archetypes = locationArchetypeReferences(THREE_MUSKETEERS)

    assert.includeMembers(unique, ['paris', 'rue_des_fossoyeurs'])
    assert.includeMembers(archetypes, ['tavern', 'town'])
    assert.lengthOf(
      unique.filter((reference) => archetypes.includes(reference)),
      0
    )
    assert.lengthOf([...unique, ...archetypes], THREE_MUSKETEERS.locations.length)
  })
})
