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
  narratedRound,
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
    others: [],
    engagement: {
      opponent: 'cardinal_guard_1',
      character_attacks: true,
      parry_possible: true,
      dodge_possible: true,
      defense_modifiers: [],
      opponent_aware: true,
      riposte_possible: true,
      opponent_defense_modifiers: [],
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

  test('an opponent caught unaware neither defends nor strikes back', ({ assert }) => {
    /** No defence rolled: the rapier 4 + 1 and the modifier 2, less the coat. */
    const played = playRound(
      buildEngine([4, 2]),
      round({ engagement: { ...round().engagement, opponent_aware: false } })
    )

    assert.isNull(played.characterBlow?.defense)
    assert.equal(played.characterBlow?.landed, 'success')
    assert.equal(played.opponentAfter.damage, 6)
    assert.isNull(played.riposte)
    assert.isTrue(played.opponentCaughtUnaware)
    assert.isFalse(played.opponentOutOfReach)
    assert.isTrue(narratedRound(played).opponent_caught_unaware)
  })

  test('an opponent out of reach defends, but does not strike back', ({ assert }) => {
    /** The guard's parry 90, then the blow lands: no riposte from across the street. */
    const played = playRound(
      buildEngine([90, 4, 2]),
      round({ engagement: { ...round().engagement, riposte_possible: false } })
    )

    assert.equal(played.characterBlow?.defense?.defense, 'parry')
    assert.isNull(played.riposte)
    assert.isTrue(played.opponentOutOfReach)
    assert.isTrue(narratedRound(played).opponent_out_of_reach)
  })

  test('circumstances weigh on the opponent’s hidden defence', ({ assert }) => {
    /** The guard's parry at 60 − 20: 50 fails it; the blow lands; the riposte misses on 95. */
    const played = playRound(
      buildEngine([50, 4, 2, 95]),
      round({
        engagement: {
          ...round().engagement,
          opponent_defense_modifiers: [{ source: 'cornered', effect: 'major_penalty' }],
        },
      })
    )

    assert.equal(played.characterBlow?.defense?.resolution.chance, 40)
    assert.equal(played.characterBlow?.landed, 'success')
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

test.group('Combat | several opponents', () => {
  /** A passer-by turned hostile, fists only, untrained: 15 to hit. */
  const bystander = {
    handle: 'commoner_1',
    definition: commoner,
    hitPoints: 10,
    bleeding: false,
    dying: false,
    items: [],
  }
  const secondGuard = { ...round().opponent, handle: 'cardinal_guard_2' }

  test('another hostile may strike back in the opponent’s place', ({ assert }) => {
    /**
     * The guard's parry 90, the rapier 4 and the modifier 2; the draw 2 of 2
     * falls on the passer-by, whose fists land on 10 against the character's
     * parry 80, for 3.
     */
    const played = playRound(buildEngine([90, 4, 2, 2, 10, 80, 3]), round({ others: [bystander] }))

    assert.equal(played.opponentAfter.damage, 6)
    assert.equal(played.riposte?.by, 'commoner_1')
    assert.isNull(played.riposte?.weapon)
    assert.equal(played.character.damage, 3)
    assert.deepEqual(played.riposterAfter, { hitPoints: 10, damage: 0, state: 'fighting' })
    assert.equal(narratedRound(played).opponent_blow_by, 'commoner_1')
  })

  test('the draw may fall on the opponent', ({ assert }) => {
    /** The draw 1 of 2: the guard himself, who misses on 95. */
    const played = playRound(buildEngine([90, 4, 2, 1, 95]), round({ others: [bystander] }))

    assert.equal(played.riposte?.by, 'cardinal_guard_1')
    assert.isNull(played.riposterAfter)
    assert.equal(narratedRound(played).opponent_blow_by, 'cardinal_guard_1')
  })

  test('a blow the opponent never sees coming: no one strikes back', ({ assert }) => {
    /** No defence, no draw: the rapier 4 and the modifier 2, and nothing more is rolled. */
    const played = playRound(
      buildEngine([4, 2]),
      round({
        others: [bystander],
        engagement: { ...round().engagement, opponent_aware: false },
      })
    )

    assert.isNull(played.riposte)
    assert.isNull(narratedRound(played).opponent_blow_by)
  })

  test('the opponent down or out of reach, another still strikes — with no draw', ({ assert }) => {
    /** 12 − 10 leaves the guard down; the passer-by alone can strike, and misses on 95. */
    const down = playRound(
      buildEngine([90, 6, 4, 95]),
      round({ opponent: { ...round().opponent, hitPoints: 12 }, others: [bystander] })
    )

    assert.equal(down.opponentAfter.state, 'down')
    assert.equal(down.riposte?.by, 'commoner_1')

    const outOfReach = playRound(
      buildEngine([90, 4, 2, 95]),
      round({
        others: [bystander],
        engagement: { ...round().engagement, riposte_possible: false },
      })
    )

    assert.isTrue(outOfReach.opponentOutOfReach)
    assert.equal(outOfReach.riposte?.by, 'commoner_1')
  })

  test('someone already down or dying never strikes', ({ assert }) => {
    const played = playRound(
      buildEngine([90, 4, 2]),
      round({
        others: [
          { ...bystander, hitPoints: 2 },
          { ...secondGuard, dying: true },
        ],
        engagement: { ...round().engagement, riposte_possible: false },
      })
    )

    assert.isNull(played.riposte)
  })

  test('a riposter’s fumble is their own: their wound, their weapon', ({ assert }) => {
    /**
     * The second guard alone can strike, and fumbles on 100: table 80, he
     * hurts himself with his rapier, 3 + 1 less his coat.
     */
    const hurt = playRound(
      buildEngine([90, 4, 2, 100, 80, 3]),
      round({
        others: [secondGuard],
        engagement: { ...round().engagement, riposte_possible: false },
      })
    )

    assert.equal(hurt.riposte?.by, 'cardinal_guard_2')
    assert.equal(hurt.riposte?.fumble, 'self_injury')
    assert.deepEqual(hurt.riposterAfter, { hitPoints: 10, damage: 3, state: 'fighting' })
    assert.equal(hurt.opponentAfter.damage, 6)

    /** Table 60: the dagger he held falls. */
    const disarmed = playRound(
      buildEngine([90, 4, 2, 100, 60]),
      round({
        others: [{ ...secondGuard, items: [held('dagger')] }],
        engagement: { ...round().engagement, riposte_possible: false },
      })
    )

    assert.deepEqual(
      disarmed.lostWeapons.map(({ holder, item, fate }) => [holder, item.definition, fate]),
      [['riposter', 'dagger', 'dropped']]
    )
  })
})
