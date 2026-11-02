import { test } from '@japa/runner'

import { overlay, resolveWorld } from '#services/game/content/resolve'
import type { NpcDefinitionContent, ScenarioContent } from '#services/game/content/types'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { SEEDED_WORLDS } from '#database/seeders/01_content_seeder'
import { loreGiveaways } from '#tests/helpers/knowledge'

const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

function npc(reference: string, description = 'Someone.'): NpcDefinitionContent {
  return {
    reference,
    labels: { en: reference },
    description,
    kind: 'unique',
    generic: false,
    defaultDisposition: 'neutral',
    combat: { skills: {}, hitPointsMax: 5, weapon: null, damageModifier: null, armor: 0 },
    initialLocation: null,
  }
}

function scenarioWith(npcs: NpcDefinitionContent[]): ScenarioContent {
  return { ...THREE_MUSKETEERS_CONTENT.scenarios[0], npcs }
}

test.group('Content | scenario over world', () => {
  test("a scenario definition replaces the world's, in place", ({ assert }) => {
    const merged = overlay([npc('a'), npc('b'), npc('c')], [npc('b', 'Overridden.')])

    assert.deepEqual(
      merged.map(({ reference, description }) => [reference, description]),
      [
        ['a', 'Someone.'],
        ['b', 'Overridden.'],
        ['c', 'Someone.'],
      ]
    )
  })

  test("a scenario's own definitions come after the world's", ({ assert }) => {
    const merged = overlay([npc('a')], [npc('z'), npc('m')])

    assert.deepEqual(
      merged.map(({ reference }) => reference),
      ['a', 'z', 'm']
    )
  })

  test("a scenario fragment replaces the world's of the same reference", ({ assert }) => {
    const [first] = THREE_MUSKETEERS_CONTENT.lore
    const world = resolveWorld(THREE_MUSKETEERS_CONTENT, {
      ...THREE_MUSKETEERS_CONTENT.scenarios[0],
      lore: [
        { ...first, content: 'Rewritten for the scenario.' },
        { reference: 'only_here', kind: 'fact', content: 'New.', tags: [], secret: false },
      ],
    })

    assert.equal(world.lore[0].content, 'Rewritten for the scenario.')
    assert.equal(world.lore.at(-1)?.reference, 'only_here')
    assert.lengthOf(world.lore, THREE_MUSKETEERS_CONTENT.lore.length + 1)
  })

  test('the resolved world reads its labels and its scenario', ({ assert }) => {
    const world = resolveWorld(THREE_MUSKETEERS_CONTENT, scenarioWith([npc('newcomer')]))

    assert.equal(world.label, 'The Three Musketeers')
    assert.equal(world.npcs.at(-1)?.reference, 'newcomer')
    assert.deepEqual(world.chapters, [
      {
        reference: 'the_road_to_paris',
        label: 'The Road to Paris',
        labels: { en: 'The Road to Paris' },
      },
    ])
    assert.deepEqual(world.skills[0], {
      reference: 'swordsmanship',
      label: 'Swordsmanship',
      labels: { en: 'Swordsmanship' },
      category: 'combat',
      baseChance: 15,
    })
  })
})

test.group('Content | seeded worlds', () => {
  for (const world of SEEDED_WORLDS) {
    const skills = world.skills.map((skill) => skill.reference)

    test(`every ${world.reference} category resolves with a skill of its world, or a characteristic`, ({
      assert,
    }) => {
      for (const rule of world.actionTypes) {
        if (rule.associatedSkill === null) {
          assert.isNotNull(rule.associatedCharacteristic, rule.actionType)
        } else {
          assert.include(skills, rule.associatedSkill, rule.actionType)
        }
      }
    })

    test(`every ${world.reference} skill resolves at least one category`, ({ assert }) => {
      /**
       * A skill no category leads to could never be rolled — but for the
       * dodge, which the round rolls for itself.
       */
      const resolved = world.actionTypes.map((rule) => rule.associatedSkill)

      for (const skill of skills.filter((reference) => reference !== 'dodge')) {
        assert.include(resolved, skill)
      }
    })

    test(`${world.reference} action types are stable references, unique`, ({ assert }) => {
      const actionTypes = world.actionTypes.map((rule) => rule.actionType)

      for (const actionType of actionTypes) {
        assert.match(actionType, REFERENCE)
      }
      assert.lengthOf(new Set(actionTypes), actionTypes.length)
    })

    test(`every ${world.reference} category is described for arbitration`, ({ assert }) => {
      for (const rule of world.actionTypes) {
        assert.isNotEmpty(rule.description.trim(), rule.actionType)
      }
    })

    test(`${world.reference} scenarios are unique, with a stable reference`, ({ assert }) => {
      const references = world.scenarios.map((scenario) => scenario.reference)

      for (const reference of references) {
        assert.match(reference, REFERENCE)
      }
      assert.lengthOf(new Set(references), references.length)
    })
  }

  for (const { scenarios, ...world } of SEEDED_WORLDS) {
    for (const scenario of scenarios) {
      test(`the lore ${world.reference} / ${scenario.reference} tells the narrator gives nothing away`, ({
        assert,
      }) => {
        assert.deepEqual(loreGiveaways(world, scenario), [])
      })
    }

    test(`${world.reference} lore fragments are unique, with a stable reference`, ({ assert }) => {
      const references = world.lore.map(({ reference }) => reference)

      for (const reference of references) {
        assert.match(reference, REFERENCE)
      }
      assert.lengthOf(new Set(references), references.length)
    })
  }

  test('the lore check catches a stranger named, and a room next door', ({ assert }) => {
    const { scenarios, ...world } = THREE_MUSKETEERS_CONTENT
    const scenario = {
      ...scenarios[0],
      lore: [
        {
          reference: 'gossip',
          kind: 'ambiance' as const,
          content: 'Everyone says Athos drinks alone.',
          tags: [],
          secret: false,
        },
        {
          reference: 'kept_quiet',
          kind: 'fact' as const,
          content: 'Athos was a count.',
          tags: [],
          secret: true,
        },
      ],
    }

    assert.deepEqual(loreGiveaways(world, scenario), ['gossip: Athos'])
  })

  test('seeds each world once', ({ assert }) => {
    const references = SEEDED_WORLDS.map((world) => world.reference)

    assert.lengthOf(new Set(references), references.length)
  })
})
