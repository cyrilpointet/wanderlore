import { test } from '@japa/runner'

import {
  UnknownActionTypeError,
  actionTypesOf,
  resolutionFor,
  rollBaseFor,
} from '#services/game/resolution_rules'
import type { WorldDefinition } from '#services/game/world'
import { GASCON, THREE_MUSKETEERS } from '#tests/helpers/worlds'
import { THREE_MUSKETEERS_CONTENT } from '#database/content/three_musketeers'

const CONTENT = THREE_MUSKETEERS_CONTENT.actionTypes

/** Another world, with a category of its own and one rolled on a characteristic. */
const OTHER_WORLD: WorldDefinition = {
  ...THREE_MUSKETEERS,
  reference: 'another_world',
  actionTypes: [
    {
      actionType: 'spellcasting',
      description: 'Casting a spell.',
      associatedSkill: 'arcana',
      associatedCharacteristic: null,
    },
    {
      actionType: 'trusting_luck',
      description: 'Hoping chance favours you.',
      associatedSkill: null,
      associatedCharacteristic: 'POW',
    },
  ],
}

test.group('Resolution rules', () => {
  test('lists the action types of a world, sorted, without what resolves them', ({ assert }) => {
    assert.deepEqual(
      actionTypesOf({ ...THREE_MUSKETEERS, actionTypes: [...CONTENT].reverse() }),
      CONTENT.map(({ actionType, description }) => ({ actionType, description })).sort((a, b) =>
        a.actionType.localeCompare(b.actionType)
      )
    )
  })

  test('resolves an action type to its skill, or to its characteristic', ({ assert }) => {
    assert.deepEqual(resolutionFor(THREE_MUSKETEERS, 'melee_combat'), {
      kind: 'skill',
      skill: 'swordsmanship',
    })
    assert.deepEqual(resolutionFor(OTHER_WORLD, 'trusting_luck'), {
      kind: 'characteristic',
      characteristic: 'POW',
    })
  })

  test('fails loudly on an action type the world does not have', ({ assert }) => {
    assert.throws(() => resolutionFor(THREE_MUSKETEERS, 'spellcasting'), UnknownActionTypeError)
  })

  test("never resolves through another world's rules", ({ assert }) => {
    assert.deepEqual(resolutionFor(OTHER_WORLD, 'spellcasting'), {
      kind: 'skill',
      skill: 'arcana',
    })
    assert.notInclude(
      actionTypesOf(THREE_MUSKETEERS).map(({ actionType }) => actionType),
      'spellcasting'
    )
  })
})

test.group('Resolution rules | roll base', () => {
  const sheet = { characteristics: GASCON, skills: { swordsmanship: 60 } }

  test('a trained skill is rolled at its value on the sheet', ({ assert }) => {
    assert.deepEqual(
      rollBaseFor(THREE_MUSKETEERS, { kind: 'skill', skill: 'swordsmanship' }, sheet),
      {
        kind: 'skill',
        skill: 'swordsmanship',
        value: 60,
      }
    )
  })

  test('a skill never trained is rolled at its base chance in the world', ({ assert }) => {
    assert.deepEqual(rollBaseFor(THREE_MUSKETEERS, { kind: 'skill', skill: 'stealth' }, sheet), {
      kind: 'skill',
      skill: 'stealth',
      value: 10,
    })
  })

  test('a base chance can read a characteristic', ({ assert }) => {
    const world: WorldDefinition = {
      ...THREE_MUSKETEERS,
      skills: THREE_MUSKETEERS.skills.map((skill) =>
        skill.reference === 'athletics'
          ? { ...skill, baseChance: { characteristic: 'DEX', multiplier: 2 } }
          : skill
      ),
    }

    assert.equal(rollBaseFor(world, { kind: 'skill', skill: 'athletics' }, sheet).value, 32)
  })

  test('a characteristic is rolled at its score, the engine multiplying it', ({ assert }) => {
    assert.deepEqual(
      rollBaseFor(THREE_MUSKETEERS, { kind: 'characteristic', characteristic: 'DEX' }, sheet),
      { kind: 'characteristic', characteristic: 'DEX', value: 16 }
    )
  })
})
