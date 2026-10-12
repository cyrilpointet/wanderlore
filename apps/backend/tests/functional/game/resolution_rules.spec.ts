import { test } from '@japa/runner'

import { UnknownActionTypeError, actionTypesOf, skillFor } from '#services/game/resolution_rules'
import { THREE_MUSKETEERS, type WorldDefinition } from '#services/game/world'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'
import { seedContent } from '#tests/helpers/content'
import { createResolutionRule, createWorld, useTransaction } from '#tests/helpers/database'

const CONTENT = THREE_MUSKETEERS_CONTENT.actionTypes

test.group('Resolution rules | reading', (group) => {
  useTransaction(group)

  group.each.setup(() => seedContent())

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
    await createResolutionRule(await createWorld('another_world'), 'spellcasting', 'arcana')

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
    await createResolutionRule(await createWorld('another_world'), 'spellcasting', 'arcana')

    await assert.rejects(() => skillFor(THREE_MUSKETEERS, 'spellcasting'), UnknownActionTypeError)
    assert.equal(await skillFor(otherWorld, 'spellcasting'), 'arcana')
  })
})
