import { test } from '@japa/runner'

import { checkScenario } from '#services/game/content/coherence'
import type { ScenarioContent, WorldContent } from '#services/game/content/types'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { SEEDED_WORLDS } from '#database/seeders/01_content_seeder'

const { scenarios, ...WORLD } = THREE_MUSKETEERS_CONTENT
const SCENARIO = scenarios[0]

type WorldLevel = Omit<WorldContent, 'scenarios'>

/** The issues of the seeded content once `change` has broken it, as `[code, location, reference]`. */
function issuesAfter(change: (world: WorldLevel, scenario: ScenarioContent) => void) {
  const world = structuredClone(WORLD)
  const scenario = structuredClone(SCENARIO)
  change(world, scenario)

  return checkScenario(world, scenario).map(({ code, location, reference }) => [
    code,
    location,
    reference,
  ])
}

test.group('Coherence | the seeded content', () => {
  for (const { scenarios: seeded, ...world } of SEEDED_WORLDS) {
    for (const scenario of seeded) {
      test(`${world.reference} / ${scenario.reference} holds together`, ({ assert }) => {
        assert.deepEqual(checkScenario(world, scenario), [])
      })
    }
  }
})

test.group('Coherence | references', () => {
  test('a base chance reads a characteristic of BRP', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.skills[0].baseChance = { characteristic: 'LUCK' as never, multiplier: 2 }
      }),
      [['unknown_characteristic', 'skills.swordsmanship.baseChance.characteristic', 'LUCK']]
    )
  })

  test('a category of action resolves with a skill of the world, and there is one', ({
    assert,
  }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes[0].associatedSkill = 'fencing'
      }),
      [['unknown_skill', 'actionTypes.melee_combat.associatedSkill', 'fencing']]
    )
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes = []
      }),
      [['no_action_type', 'actionTypes', undefined]]
    )
  })

  test('a category of action may resolve with a characteristic of BRP instead', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes[0] = {
          ...world.actionTypes[0],
          associatedSkill: null,
          associatedCharacteristic: 'DEX',
        }
      }),
      []
    )
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes[0] = {
          ...world.actionTypes[0],
          associatedSkill: null,
          associatedCharacteristic: 'LUCK' as never,
        }
      }),
      [['unknown_characteristic', 'actionTypes.melee_combat.associatedCharacteristic', 'LUCK']]
    )
  })

  test('a weapon is wielded with a skill of the world, and deals dice', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        const rapier = world.items.find((item) => item.reference === 'rapier')!
        rapier.weapon = { ...rapier.weapon!, skill: 'fencing', damage: 'a lot' }
      }),
      [
        ['unknown_skill', 'items.rapier.weapon.skill', 'fencing'],
        ['invalid_dice', 'items.rapier.weapon.damage', 'a lot'],
      ]
    )
  })

  test('a fighting profile names skills and a weapon of the world', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        const athos = world.npcs.find(({ reference }) => reference === 'athos')!
        athos.combat.skills = { fencing: 5 }
        athos.combat.weapon = 'halberd'
      }),
      [
        ['unknown_skill', 'npcs.athos.combat.skills', 'fencing'],
        ['unknown_item', 'npcs.athos.combat.weapon', 'halberd'],
      ]
    )
  })

  test('a place hangs off a named place', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.locations.find(({ reference }) => reference === 'paris')!.parent = 'navarre'
      }),
      [['unknown_location', 'locations.paris.parent', 'navarre']]
    )
  })

  test("an item's modifier aims at a skill of the world", ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        const rapier = world.items.find(({ reference }) => reference === 'rapier')!
        rapier.modifiers[0] = { ...rapier.modifiers[0], target: 'skill', skill: 'fencing' }
      }),
      [['unknown_skill', 'items.rapier.modifiers.0.skill', 'fencing']]
    )
  })

  test('an item starts with a named person or place', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.items.find(({ reference }) => reference === 'queens_diamond_studs')!.initialHolder = {
          holder: 'npc',
          reference: 'musketeer',
        }
      }),
      [['unknown_holder', 'items.queens_diamond_studs.initialHolder', 'musketeer']]
    )
  })

  test('a scenario definition counts like a world one', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world, scenario) => {
        world.skills[0].baseChance = { characteristic: 'LUCK' as never, multiplier: 2 }
        scenario.npcs = [
          {
            ...world.npcs[0],
            reference: 'kitty',
            combat: { ...world.npcs[0].combat, weapon: 'fan' },
          },
        ]
      }).map(([code]) => code),
      ['unknown_characteristic', 'unknown_item']
    )
  })
})

test.group('Coherence | what the model improvises from', () => {
  test('a generic person, a place archetype and a generic item', ({ assert }) => {
    const issues = issuesAfter((world) => {
      world.npcs = world.npcs.filter((npc) => !npc.generic)
      world.locations = world.locations.filter(({ kind }) => kind === 'unique')
      world.items = world.items.filter((item) => !item.generic)
    })

    /** Removing the generic sword also leaves the royal guard without his weapon: not the point here. */
    assert.deepEqual(
      issues.filter(([code]) => String(code).startsWith('missing_')),
      [
        ['missing_generic_npc', 'npcs', undefined],
        ['missing_location_archetype', 'locations', undefined],
        ['missing_generic_item', 'items', undefined],
      ]
    )
  })
})

test.group('Coherence | the character and where the story starts', () => {
  test('a scenario has both', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.pregeneratedCharacter = null
        scenario.initialState = null
      }),
      [
        ['missing_character', 'pregeneratedCharacter', undefined],
        ['missing_initial_state', 'initialState', undefined],
      ]
    )
  })

  test('the character only has scores the world defines', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.pregeneratedCharacter!.skills.fencing = 3
        scenario.pregeneratedCharacter!.resources.gold = 3
      }),
      [
        ['unknown_skill', 'pregeneratedCharacter.skills', 'fencing'],
        ['unknown_resource', 'pregeneratedCharacter.resources', 'gold'],
      ]
    )
  })

  test('the character has the seven characteristics, within human bounds', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        const characteristics = scenario.pregeneratedCharacter!.characteristics as Record<
          string,
          number
        >
        characteristics.STR = 22
        characteristics.SIZ = 7
        delete characteristics.CHA
        characteristics.LUCK = 10
      }),
      [
        ['characteristic_out_of_range', 'pregeneratedCharacter.characteristics.STR', 'STR'],
        ['characteristic_out_of_range', 'pregeneratedCharacter.characteristics.SIZ', 'SIZ'],
        ['characteristic_out_of_range', 'pregeneratedCharacter.characteristics.CHA', 'CHA'],
        ['unknown_characteristic', 'pregeneratedCharacter.characteristics', 'LUCK'],
      ]
    )
  })

  test('the character starts with items it can hold as declared', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.pregeneratedCharacter!.items = [
          { definition: 'halberd', descriptor: null, quantity: 1, equipped: false },
          { definition: 'letter_to_treville', descriptor: null, quantity: 1, equipped: true },
          { definition: 'rapier', descriptor: null, quantity: 2, equipped: false },
          { definition: 'queens_diamond_studs', descriptor: null, quantity: 1, equipped: false },
        ]
      }),
      [
        ['unknown_item', 'pregeneratedCharacter.items.0.definition', 'halberd'],
        ['not_equippable', 'pregeneratedCharacter.items.1.equipped', 'letter_to_treville'],
        ['not_stackable', 'pregeneratedCharacter.items.2.quantity', 'rapier'],
        ['item_held_elsewhere', 'pregeneratedCharacter.items.3.definition', 'queens_diamond_studs'],
      ]
    )
  })

  test('the story starts in a named place, in a chapter and on quests of the scenario', ({
    assert,
  }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.initialState = {
          location: 'tavern',
          chapter: 'the_siege',
          quests: [{ reference: 'find_the_studs', step: 1, summary: 'Find them.' }],
        }
      }),
      [
        ['unknown_location', 'initialState.location', 'tavern'],
        ['unknown_chapter', 'initialState.chapter', 'the_siege'],
        ['unknown_quest', 'initialState.quests.0', 'find_the_studs'],
      ]
    )
  })
})

test.group('Coherence | names', () => {
  test('every name has an English version', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.quests[0].labels = { en: ' ', fr: 'Remettre la lettre' }
      }),
      [['missing_english_label', 'quests.deliver_the_letter', undefined]]
    )
  })
})
