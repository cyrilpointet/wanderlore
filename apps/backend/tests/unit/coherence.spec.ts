import { test } from '@japa/runner'

import { checkScenario } from '#services/game/content/coherence'
import type {
  LocationDefinitionContent,
  ScenarioContent,
  WorldContent,
} from '#services/game/content/types'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { SEEDED_WORLDS } from '#database/seeders/01_content_seeder'
import { HOUSE_PLACES, IRON_KEY, exit } from '#tests/helpers/places'

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
  test('a lore tag names a place, a person or an item', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.lore.push({
          reference: 'siege',
          kind: 'fact',
          content: 'The town is under siege.',
          tags: ['paris', 'treville', 'rapier', 'la_rochelle'],
          secret: false,
        })
      }),
      [['unknown_tag', 'lore.siege.tags', 'la_rochelle']]
    )
  })

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
      [
        ['no_action_type', 'actionTypes', undefined],
        ['missing_system_reference', 'actionTypes', 'melee_combat'],
        ['missing_system_reference', 'actionTypes', 'ranged_combat'],
        ['missing_system_reference', 'actionTypes', 'first_aid'],
      ]
    )
  })

  test('a category of action may resolve with a characteristic of BRP instead', ({ assert }) => {
    /** Not an attacking one: the parry and the riposte read a skill. */
    const perception = (world: { actionTypes: { actionType: string }[] }) =>
      world.actionTypes.findIndex(({ actionType }) => actionType === 'perception')

    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes[perception(world)] = {
          ...world.actionTypes[perception(world)],
          associatedSkill: null,
          associatedCharacteristic: 'DEX',
        }
      }),
      []
    )
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes[perception(world)] = {
          ...world.actionTypes[perception(world)],
          associatedSkill: null,
          associatedCharacteristic: 'LUCK' as never,
        }
      }),
      [['unknown_characteristic', 'actionTypes.perception.associatedCharacteristic', 'LUCK']]
    )
  })

  test('a weapon deals dice', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        const rapier = world.items.find((item) => item.reference === 'rapier')!
        rapier.weapon = { ...rapier.weapon!, damage: 'a lot' }
      }),
      [['invalid_dice', 'items.rapier.weapon.damage', 'a lot']]
    )
  })

  test('the ordinary weapon of a person is a weapon, their damage modifier dice', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        const athos = world.npcs.find((npc) => npc.reference === 'athos')!
        athos.combat = { ...athos.combat, weapon: 'buff_coat', damageModifier: 'plenty' }
      }),
      [
        ['not_a_weapon', 'npcs.athos.combat.weapon', 'buff_coat'],
        ['invalid_dice', 'npcs.athos.combat.damageModifier', 'plenty'],
      ]
    )
  })

  test('a world declares what the system reads for itself', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes = world.actionTypes.filter(({ actionType }) => actionType !== 'first_aid')
        world.skills = world.skills.filter(({ reference }) => reference !== 'dodge')
      }),
      [
        ['missing_system_reference', 'actionTypes', 'first_aid'],
        ['missing_system_reference', 'skills', 'dodge'],
      ]
    )
  })

  test('both attacking categories are resolved by a skill', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.actionTypes = world.actionTypes.map((rule) =>
          rule.actionType === 'melee_combat'
            ? { ...rule, associatedSkill: null, associatedCharacteristic: 'STR' }
            : rule
        )
      }),
      [['combat_needs_skill', 'actionTypes.melee_combat.associatedSkill', 'melee_combat']]
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

  test('only a named person can be known by name from the start', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_, scenario) => {
        scenario.initialState!.knownNpcs = ['treville', 'cardinal_guard', 'nobody']
      }),
      [
        ['unknown_npc', 'initialState.knownNpcs.1', 'cardinal_guard'],
        ['unknown_npc', 'initialState.knownNpcs.2', 'nobody'],
      ]
    )
  })

  test('a person waits from the start in a named place', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.npcs.find(({ reference }) => reference === 'treville')!.initialLocation = 'tavern'
      }),
      [['unknown_location', 'npcs.treville.initialLocation', 'tavern']]
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
        scenario.quests[0].labels = { en: ' ', fr: 'Reprendre le sceau' }
      }),
      [['missing_english_label', 'quests.recover_the_seal', undefined]]
    )
  })
})

test.group('Coherence | exits and networks', () => {
  /** The seeded scenario with the house of the specs among its places. */
  function houseIssuesAfter(change: (places: LocationDefinitionContent[]) => void) {
    return issuesAfter((_world, scenario) => {
      const places = structuredClone(HOUSE_PLACES)
      change(places)
      scenario.locations.push(...places)
      scenario.items.push(IRON_KEY)
    })
  }

  const house = (places: LocationDefinitionContent[], reference: string) =>
    places.find((place) => place.reference === reference)!

  test('a house gone through room by room holds together', ({ assert }) => {
    assert.deepEqual(
      houseIssuesAfter(() => {}),
      []
    )
  })

  test('an exit leads to another named place that exists', ({ assert }) => {
    assert.deepEqual(
      houseIssuesAfter((places) => {
        house(places, 'house_attic').exits.push(
          exit('house_roof', 'a skylight'),
          exit('house_attic', 'a mirror'),
          exit('tavern', 'a painted door')
        )
      }),
      [
        ['unknown_location', 'locations.house_attic.exits.0.to', 'house_roof'],
        ['exit_to_itself', 'locations.house_attic.exits.1.to', 'house_attic'],
        ['unknown_location', 'locations.house_attic.exits.2.to', 'tavern'],
      ]
    )
  })

  test('one passage at most joins two places, whichever side declares it', ({ assert }) => {
    assert.deepEqual(
      houseIssuesAfter((places) => {
        house(places, 'house_kitchen').exits.push(exit('house_hall', 'a serving hatch'))
      }),
      [['duplicate_passage', 'locations.house_kitchen.exits.1', 'house_hall']]
    )
  })

  test('the item a passage requires exists, and its duration is on the scale', ({ assert }) => {
    assert.deepEqual(
      houseIssuesAfter((places) => {
        const [door] = house(places, 'house_corridor').exits
        door.requires = 'skeleton_key'
        door.duration = 'days' as never
      }),
      [
        ['unknown_item', 'locations.house_corridor.exits.0.requires', 'skeleton_key'],
        ['invalid_duration', 'locations.house_corridor.exits.0.duration', 'days'],
      ]
    )
  })

  test('an entrance is part of a network', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        world.locations.find(({ reference }) => reference === 'louvre')!.entrance = true
      }),
      [['entrance_without_exits', 'locations.louvre.entrance', 'louvre']]
    )
  })

  test('a network nothing leads into is refused, unless the story starts in it', ({ assert }) => {
    const sealed = (places: LocationDefinitionContent[]) => {
      for (const place of places) {
        place.entrance = false
      }
    }

    assert.deepEqual(houseIssuesAfter(sealed), [
      ['unreachable_network', 'locations.house_attic', 'house_attic'],
    ])
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        const places = structuredClone(HOUSE_PLACES)
        sealed(places)
        scenario.locations.push(...places)
        scenario.items.push(IRON_KEY)
        scenario.initialState!.location = 'house_vault'
      }),
      []
    )
  })

  test('the story never starts in a place that only contains a network', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.locations.push(...structuredClone(HOUSE_PLACES))
        scenario.items.push(IRON_KEY)
        scenario.initialState!.location = 'house'
      }),
      [['start_contains_network', 'initialState.location', 'house']]
    )
  })
})

test.group('Coherence | schedules and events', () => {
  const athos = (world: WorldLevel) => world.npcs.find(({ reference }) => reference === 'athos')!

  test('a schedule sends someone to named places, each period once', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((world) => {
        athos(world).schedule = [
          {
            periods: ['morning', 'midday'],
            location: 'hotel_de_treville',
            activity: null,
            leavesScene: false,
            interrupts: false,
          },
          {
            periods: ['midday'],
            location: 'la_rochelle',
            activity: null,
            leavesScene: false,
            interrupts: false,
          },
        ]
      }),
      [
        ['unknown_location', 'npcs.athos.schedule.1.location', 'la_rochelle'],
        ['schedule_overlap', 'npcs.athos.schedule.1.periods', 'midday'],
      ]
    )
  })

  test('an event names declared flags, unique people and items, and named places', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.events.push({
          reference: 'guards_arrive',
          when: {
            at: null,
            conditions: [
              { type: 'flag', flag: 'guards_bribed' },
              { type: 'npc_at', npc: 'royal_guard', location: 'paris' },
            ],
            delay: null,
          },
          unless: [{ type: 'item_gone', item: 'rapier' }],
          place: 'la_rochelle',
          description: 'The guards come.',
          effects: [
            { type: 'npc_entered', npc: 'royal_guard', location: 'louvre', descriptor: null },
            { type: 'passage_blocked', from: 'paris', to: 'louvre' },
          ],
          interrupts: false,
          foreseeable: null,
        })
      }),
      [
        ['unknown_location', 'events.guards_arrive.place', 'la_rochelle'],
        ['unknown_flag', 'events.guards_arrive.when.conditions.0.flag', 'guards_bribed'],
        ['not_unique', 'events.guards_arrive.when.conditions.1.npc', 'royal_guard'],
        ['not_unique', 'events.guards_arrive.unless.0.item', 'rapier'],
        ['unknown_passage', 'events.guards_arrive.effects.1', 'paris|louvre'],
      ]
    )
  })

  test('an event is set off by a deadline or by conditions', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.events.push({
          reference: 'nothing_sets_it_off',
          when: { at: null, conditions: [], delay: { label: 'hour' } },
          unless: [],
          place: null,
          description: 'Nothing.',
          effects: [{ type: 'flag_set', flag: 'seal_found' }],
          interrupts: false,
          foreseeable: null,
        })
      }),
      [['event_without_trigger', 'events.nothing_sets_it_off.when', 'nothing_sets_it_off']]
    )
  })

  test('no chain of events sets itself off again', ({ assert }) => {
    const chained = (reference: string, needs: string, sets: string) => ({
      reference,
      when: { at: null, conditions: [{ type: 'flag' as const, flag: needs }], delay: null },
      unless: [],
      place: null,
      description: `${reference}.`,
      effects: [{ type: 'flag_set' as const, flag: sets }],
      interrupts: false,
      foreseeable: null,
    })

    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.events.push(
          chained('first', 'seal_found', 'jussac_challenged'),
          chained('second', 'jussac_challenged', 'seal_found')
        )
      }),
      [
        ['event_cycle', 'events.first', 'first'],
        ['event_cycle', 'events.second', 'second'],
      ]
    )
  })

  test('a chain that ends is no cycle', ({ assert }) => {
    assert.deepEqual(
      issuesAfter((_world, scenario) => {
        scenario.events.push({
          reference: 'rochefort_sent_for',
          when: {
            at: null,
            conditions: [{ type: 'flag', flag: 'alarm_raised' }],
            delay: { label: 'hours' },
          },
          unless: [],
          place: 'laffemas_courtyard',
          description: 'Rochefort rides in, sent for by the roused guards.',
          effects: [
            { type: 'npc_moved', npc: 'rochefort', location: 'laffemas_courtyard' },
            { type: 'flag_set', flag: 'jussac_challenged' },
          ],
          interrupts: false,
          foreseeable: [],
        })
      }),
      []
    )
  })
})
