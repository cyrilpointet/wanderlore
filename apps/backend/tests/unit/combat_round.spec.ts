import { test } from '@japa/runner'

import { DiceService } from '#services/dice'
import { RulesEngine } from '#services/rules/engine'
import type { RollResolution } from '#services/rules/types'
import type { HeldItem } from '#services/game/inventory'
import {
  BARE_HANDS,
  THROWN_OBJECT,
  armorOf,
  characterWeaponOf,
  npcBase,
  opponentWeaponOf,
  playRound,
  type RoundInput,
} from '#services/game/combat'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { GASCON, THREE_MUSKETEERS } from '#tests/helpers/worlds'

/** As the rules specs: an engine of its own, its dice arranged face by face. */
function buildEngine(faces: number[]) {
  return new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces)))
}

const held = (definition: string, equipped = false): HeldItem => ({
  handle: `${definition}_1`,
  definition,
  descriptor: null,
  quantity: 1,
  equipped,
})

const guard = THREE_MUSKETEERS.npcs.find(({ reference }) => reference === 'cardinal_guard')!
const commoner = THREE_MUSKETEERS.npcs.find(({ reference }) => reference === 'commoner')!

/** A successful lunge: what the action roll gave before the round. */
const LUNGE = {
  roll: 20,
  result: 'success',
  degree: 'success',
} as unknown as RollResolution

function round(overrides: Partial<RoundInput> = {}): RoundInput {
  return {
    world: THREE_MUSKETEERS,
    character: {
      characteristics: GASCON,
      skills: { swordsmanship: 60 },
      hitPoints: 26,
      hitPointsMax: 26,
      bleeding: false,
    },
    characterItems: [held('rapier', true)],
    opponent: {
      handle: 'cardinal_guard_1',
      definition: guard,
      hitPoints: 13,
      bleeding: false,
      dying: false,
      items: [],
    },
    engagement: {
      opponent: 'cardinal_guard_1',
      character_attacks: true,
      parry_possible: true,
      dodge_possible: true,
      defense_modifiers: [],
    },
    attack: { actionType: 'melee_combat', resolution: LUNGE },
    ...overrides,
  }
}

test.group('Combat | weapons and armour', () => {
  test('the character fights with what they drew, else what fits, else bare hands', ({
    assert,
  }) => {
    const items = [held('pistol'), held('dagger'), held('rapier', true)]

    assert.equal(
      characterWeaponOf(THREE_MUSKETEERS, items, 'melee_combat').weapon.reference,
      'rapier'
    )
    assert.equal(
      characterWeaponOf(THREE_MUSKETEERS, items, 'ranged_combat').weapon.reference,
      'pistol'
    )
    assert.equal(characterWeaponOf(THREE_MUSKETEERS, [], 'melee_combat').weapon, BARE_HANDS)
    assert.equal(characterWeaponOf(THREE_MUSKETEERS, [], 'ranged_combat').weapon, THROWN_OBJECT)
  })

  test('a weapon a person holds outranks their ordinary one', ({ assert }) => {
    assert.equal(
      opponentWeaponOf(THREE_MUSKETEERS, { definition: guard, items: [] }).weapon.reference,
      'rapier'
    )
    assert.equal(
      opponentWeaponOf(THREE_MUSKETEERS, { definition: guard, items: [held('pistol')] }).weapon
        .reference,
      'pistol'
    )
    assert.equal(
      opponentWeaponOf(THREE_MUSKETEERS, { definition: commoner, items: [] }).weapon,
      BARE_HANDS
    )
  })

  test('the best armour worn counts, never the sum', ({ assert }) => {
    assert.equal(armorOf(THREE_MUSKETEERS, [held('buff_coat', true), held('buff_coat', true)]), 1)
    assert.equal(armorOf(THREE_MUSKETEERS, []), 0)
  })

  test('a person untrained in a skill has its base chance, on an ordinary adult', ({ assert }) => {
    assert.equal(npcBase(THREE_MUSKETEERS, guard, 'swordsmanship').value, 60)
    /** DEX × 2, on the ordinary 10. */
    assert.equal(npcBase(THREE_MUSKETEERS, guard, 'dodge').value, 20)
  })
})

test.group('Combat | the round', () => {
  test('a stopped opponent does not strike back', ({ assert }) => {
    /**
     * A special with bare hands is a crushing blow: the guard's parry 90, the
     * fists 2, the doubled +1D4 3 and 1. Stunned, he cannot strike back.
     */
    const played = playRound(
      buildEngine([90, 2, 3, 1]),
      round({
        characterItems: [],
        attack: {
          actionType: 'melee_combat',
          resolution: { ...LUNGE, degree: 'special' } as RollResolution,
        },
      })
    )

    assert.equal(played.characterBlow?.hit?.effect, 'crushing')
    assert.isNull(played.riposte)
  })

  test('an opponent brought down strikes no more', ({ assert }) => {
    /** The parry 90, the rapier 6 + 1 and the modifier 4, less the coat: 12 − 10 leaves 2. */
    const played = playRound(
      buildEngine([90, 6, 4]),
      round({ opponent: { ...round().opponent, hitPoints: 12 } })
    )

    assert.equal(played.opponentAfter.state, 'down')
    assert.isNull(played.riposte)
  })

  test('a wound from an earlier round bleeds on', ({ assert }) => {
    /** No blow of their own; the riposte misses on 95. */
    const played = playRound(
      buildEngine([95]),
      round({
        attack: null,
        engagement: { ...round().engagement, character_attacks: false },
        character: { ...round().character, bleeding: true },
      })
    )

    assert.equal(played.character.hitPoints, 25)
    assert.equal(played.character.damage, 1)
  })

  test('a fumbled attack drops the weapon drawn, and the riposte comes easy', ({ assert }) => {
    /** The fumble table 60: dropped; the riposte 100 — a fumble of its own, table 10: nothing. */
    const played = playRound(
      buildEngine([60, 100, 10]),
      round({
        attack: {
          actionType: 'melee_combat',
          resolution: { ...LUNGE, result: 'failure', degree: 'fumble' } as RollResolution,
        },
      })
    )

    assert.equal(played.characterBlow?.fumble, 'weapon_dropped')
    assert.deepEqual(
      played.lostWeapons.map(({ holder, fate }) => [holder, fate]),
      [['character', 'dropped']]
    )
  })
})
