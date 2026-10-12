import { test } from '@japa/runner'

import {
  ITEM_CONDITIONS,
  itemArchetypeReferences,
  itemReferences,
  locationArchetypeReferences,
  npcReferences,
  uniqueLocationReferences,
  type ContentEntry,
  type LocationDefinition,
} from '#services/game/world'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'

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
  ['items', THREE_MUSKETEERS.items],
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

test.group('World definition | combat profiles', () => {
  const skills = THREE_MUSKETEERS.skills.map((skill) => skill.reference)
  const weapons = THREE_MUSKETEERS.items
    .filter((item) => item.modifiers.some((modifier) => modifier.target === 'damage'))
    .map((item) => item.reference)

  test('every skill of a profile is a skill of the world, at a sheet value', ({ assert }) => {
    for (const npc of THREE_MUSKETEERS.npcs) {
      for (const [skill, value] of Object.entries(npc.combat.skills)) {
        assert.include(skills, skill, npc.reference)
        assert.isTrue(Number.isInteger(value) && value >= 0 && value <= 5, npc.reference)
      }
    }
  })

  test('everyone can take a blow', ({ assert }) => {
    for (const npc of THREE_MUSKETEERS.npcs) {
      assert.isTrue(Number.isInteger(npc.combat.hitPointsMax), npc.reference)
      assert.isAbove(npc.combat.hitPointsMax, 0, npc.reference)
    }
  })

  test('an ordinary weapon is an item that deals damage', ({ assert }) => {
    for (const npc of THREE_MUSKETEERS.npcs) {
      if (npc.combat.weapon !== null) {
        assert.include(weapons, npc.combat.weapon, npc.reference)
      }
    }
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

test.group('World definition | items', () => {
  const items = THREE_MUSKETEERS.items
  const skills = THREE_MUSKETEERS.skills.map((skill) => skill.reference)

  test('every definition is described for the model', ({ assert }) => {
    for (const item of items) {
      assert.isNotEmpty(item.description.trim(), item.reference)
    }
  })

  test('every modifier is a whole, non-zero value with a known condition', ({ assert }) => {
    for (const item of items) {
      for (const modifier of item.modifiers) {
        assert.isTrue(Number.isInteger(modifier.value), item.reference)
        assert.notEqual(modifier.value, 0, item.reference)
        assert.include(ITEM_CONDITIONS, modifier.condition, item.reference)
        assert.isNotEmpty(modifier.description.trim(), item.reference)
      }
    }
  })

  test('every skill modifier aims at a skill of the world', ({ assert }) => {
    for (const item of items) {
      for (const modifier of item.modifiers) {
        if (modifier.target === 'skill') {
          assert.include(skills, modifier.skill, item.reference)
        }
      }
    }
  })

  test('only an item that can be equipped asks to be equipped', ({ assert }) => {
    for (const item of items.filter((entry) => !entry.equippable)) {
      for (const modifier of item.modifiers) {
        assert.notEqual(modifier.condition, 'equipped', item.reference)
      }
    }
  })

  test('a damage bonus is positive and comes from a wielded item', ({ assert }) => {
    for (const item of items) {
      for (const modifier of item.modifiers.filter((entry) => entry.target === 'damage')) {
        assert.isAbove(modifier.value, 0, item.reference)
        assert.isTrue(item.equippable, item.reference)
      }
    }
  })

  test('an item counts its bonus to damage once at most', ({ assert }) => {
    for (const item of items) {
      const damage = item.modifiers.filter((modifier) => modifier.target === 'damage')

      assert.isAtMost(damage.length, 1, item.reference)
    }
  })

  test('every initial holder is a unique character or a unique place', ({ assert }) => {
    const uniqueNpcs = THREE_MUSKETEERS.npcs
      .filter((npc) => npc.kind === 'unique')
      .map((npc) => npc.reference)
    const uniquePlaces = uniqueLocationReferences(THREE_MUSKETEERS)

    for (const item of items) {
      if (item.kind !== 'unique' || item.initialHolder === null) {
        continue
      }

      const { holder, reference } = item.initialHolder
      const known = holder === 'npc' ? uniqueNpcs : uniquePlaces

      assert.include(known, reference, `${item.reference} → ${holder} ${reference}`)
    }
  })

  test('places items with characters and in places from the start', ({ assert }) => {
    const holders = items.flatMap((item) =>
      item.kind === 'unique' && item.initialHolder !== null ? [item.initialHolder.holder] : []
    )

    assert.includeMembers(holders, ['npc', 'location'])
  })

  test('declares generic archetypes for improvised items, stackable ones among them', ({
    assert,
  }) => {
    const generics = items.filter((item) => item.kind === 'archetype' && item.generic)

    assert.isNotEmpty(generics)
    assert.isTrue(generics.some((item) => item.kind === 'archetype' && item.stackable))
  })

  test('no unique item could be mistaken for a copy of an archetype', ({ assert }) => {
    /** Both share a game's handles: `letter_to_treville`, but `rapier_2`. */
    for (const archetype of itemArchetypeReferences(THREE_MUSKETEERS)) {
      const handle = new RegExp(`^${archetype}_\\d+$`)

      for (const item of items) {
        assert.notMatch(item.reference, handle)
      }
    }
  })

  test('lists every definition in the closed list, archetypes apart', ({ assert }) => {
    assert.sameMembers(
      itemReferences(THREE_MUSKETEERS),
      items.map((item) => item.reference)
    )
    assert.sameMembers(
      itemArchetypeReferences(THREE_MUSKETEERS),
      items.filter((item) => item.kind === 'archetype').map((item) => item.reference)
    )
  })
})
