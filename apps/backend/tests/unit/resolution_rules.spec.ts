import { test } from '@japa/runner'

import { UnknownActionTypeError, actionTypesOf, skillFor } from '#services/game/resolution_rules'
import type { WorldDefinition } from '#services/game/world'
import { THREE_MUSKETEERS } from '#tests/helpers/worlds'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'

const CONTENT = THREE_MUSKETEERS_CONTENT.actionTypes

/** Another world, with a category of its own. */
const OTHER_WORLD: WorldDefinition = {
  ...THREE_MUSKETEERS,
  reference: 'another_world',
  actionTypes: [
    { actionType: 'spellcasting', description: 'Casting a spell.', associatedSkill: 'arcana' },
  ],
}

test.group('Resolution rules', () => {
  test('lists the action types of a world, sorted, without their skill', ({ assert }) => {
    assert.deepEqual(
      actionTypesOf({ ...THREE_MUSKETEERS, actionTypes: [...CONTENT].reverse() }),
      CONTENT.map(({ actionType, description }) => ({ actionType, description })).sort((a, b) =>
        a.actionType.localeCompare(b.actionType)
      )
    )
  })

  test('resolves an action type to its skill', ({ assert }) => {
    assert.equal(skillFor(THREE_MUSKETEERS, 'melee_combat'), 'swordsmanship')
    assert.equal(skillFor(THREE_MUSKETEERS, 'social_deception'), 'deception')
  })

  test('fails loudly on an action type the world does not have', ({ assert }) => {
    assert.throws(() => skillFor(THREE_MUSKETEERS, 'spellcasting'), UnknownActionTypeError)
  })

  test("never resolves through another world's rules", ({ assert }) => {
    assert.equal(skillFor(OTHER_WORLD, 'spellcasting'), 'arcana')
    assert.notInclude(
      actionTypesOf(THREE_MUSKETEERS).map(({ actionType }) => actionType),
      'spellcasting'
    )
  })
})
