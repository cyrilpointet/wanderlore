import { test } from '@japa/runner'

import { RESOLUTION_RULES } from '#services/game/resolution_rule_content'

const REFERENCE = /^[a-z][a-z0-9_]{0,63}$/

test.group('Resolution rule content', () => {
  for (const { world, rules } of RESOLUTION_RULES) {
    const skills = world.skills.map((skill) => skill.reference)

    test(`every ${world.reference} rule resolves with a skill of its world`, ({ assert }) => {
      /** No foreign key can check this until skills move to the database in Phase 5. */
      for (const rule of rules) {
        assert.include(skills, rule.associatedSkill, rule.actionType)
      }
    })

    test(`every ${world.reference} skill resolves at least one category`, ({ assert }) => {
      /** A skill no category leads to could never be rolled. */
      const resolved = rules.map((rule) => rule.associatedSkill)

      for (const skill of skills) {
        assert.include(resolved, skill)
      }
    })

    test(`${world.reference} action types are stable references, unique`, ({ assert }) => {
      const actionTypes = rules.map((rule) => rule.actionType)

      for (const actionType of actionTypes) {
        assert.match(actionType, REFERENCE)
      }
      assert.lengthOf(new Set(actionTypes), actionTypes.length)
    })

    test(`every ${world.reference} rule is described for arbitration`, ({ assert }) => {
      for (const rule of rules) {
        assert.isNotEmpty(rule.description.trim(), rule.actionType)
      }
    })
  }

  test('covers each world once', ({ assert }) => {
    const worlds = RESOLUTION_RULES.map(({ world }) => world.reference)

    assert.lengthOf(new Set(worlds), worlds.length)
  })
})
