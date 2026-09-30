import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

import { RESOLUTION_RULES } from '#services/game/resolution_rule_content'
import { UnknownActionTypeError, actionTypesOf, skillFor } from '#services/game/resolution_rules'
import { THREE_MUSKETEERS, type WorldDefinition } from '#services/game/world'
import { seedResolutionRules } from '#tests/helpers/content'
import { countRows, createResolutionRule, useTransaction } from '#tests/helpers/database'

const CONTENT = RESOLUTION_RULES.find(({ world }) => world === THREE_MUSKETEERS)!.rules

test.group('Resolution rules | seeder', (group) => {
  useTransaction(group)

  test('writes every rule of the code', async ({ assert }) => {
    await seedResolutionRules()

    assert.equal(
      await countRows('resolution_rules', { world_reference: THREE_MUSKETEERS.reference }),
      CONTENT.length
    )
  })

  test('re-run, duplicates nothing', async ({ assert }) => {
    await seedResolutionRules()
    await seedResolutionRules()

    assert.equal(
      await countRows('resolution_rules', { world_reference: THREE_MUSKETEERS.reference }),
      CONTENT.length
    )
  })

  test('re-run, brings a row back in line with the code', async ({ assert }) => {
    await seedResolutionRules()
    await db
      .from('resolution_rules')
      .where({ world_reference: THREE_MUSKETEERS.reference, action_type: 'melee_combat' })
      .update({ description: 'An outdated description.', associated_skill: 'athletics' })

    await seedResolutionRules()

    const row = await db
      .from('resolution_rules')
      .where({ world_reference: THREE_MUSKETEERS.reference, action_type: 'melee_combat' })
      .firstOrFail()
    const expected = CONTENT.find((rule) => rule.actionType === 'melee_combat')!

    assert.equal(row.description, expected.description)
    assert.equal(row.associated_skill, expected.associatedSkill)
  })

  test('re-run, drops a category the code no longer has', async ({ assert }) => {
    /** Left in place, it would still be offered to arbitration. */
    await createResolutionRule(THREE_MUSKETEERS.reference, 'retired_category', 'athletics')

    await seedResolutionRules()

    assert.equal(
      await countRows('resolution_rules', {
        world_reference: THREE_MUSKETEERS.reference,
        action_type: 'retired_category',
      }),
      0
    )
  })

  test("leaves another world's rules alone", async ({ assert }) => {
    await createResolutionRule('another_world', 'melee_combat', 'brawling')

    await seedResolutionRules()

    assert.equal(await countRows('resolution_rules', { world_reference: 'another_world' }), 1)
  })
})

test.group('Resolution rules | reading', (group) => {
  useTransaction(group)

  group.each.setup(() => seedResolutionRules())

  test('lists the action types of a world, sorted, without their skill', async ({ assert }) => {
    const actionTypes = await actionTypesOf(THREE_MUSKETEERS)

    assert.deepEqual(
      actionTypes,
      CONTENT.map(({ actionType, description }) => ({ actionType, description })).sort((a, b) =>
        a.actionType.localeCompare(b.actionType)
      )
    )
  })

  test('lists only the rules of the world asked for', async ({ assert }) => {
    await createResolutionRule('another_world', 'spellcasting', 'arcana')

    const actionTypes = await actionTypesOf(THREE_MUSKETEERS)

    assert.notInclude(
      actionTypes.map(({ actionType }) => actionType),
      'spellcasting'
    )
  })

  test('resolves an action type to its skill', async ({ assert }) => {
    assert.equal(await skillFor(THREE_MUSKETEERS, 'melee_combat'), 'swordsmanship')
    assert.equal(await skillFor(THREE_MUSKETEERS, 'social_deception'), 'deception')
  })

  test('fails loudly on an action type the world does not have', async ({ assert }) => {
    await assert.rejects(() => skillFor(THREE_MUSKETEERS, 'spellcasting'), UnknownActionTypeError)
  })

  test("never resolves through another world's rules", async ({ assert }) => {
    const otherWorld: WorldDefinition = { ...THREE_MUSKETEERS, reference: 'another_world' }
    await createResolutionRule('another_world', 'spellcasting', 'arcana')

    await assert.rejects(() => skillFor(THREE_MUSKETEERS, 'spellcasting'), UnknownActionTypeError)
    assert.equal(await skillFor(otherWorld, 'spellcasting'), 'arcana')
  })
})
