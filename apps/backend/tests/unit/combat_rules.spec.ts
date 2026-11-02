import { test } from '@japa/runner'

import { DiceService } from '#services/dice'
import type { Degree, HitDegree, RollBase, Weapon } from '#services/rules/types'
import {
  RulesEngine,
  bestDefense,
  defenseOptions,
  fumbleOf,
  healingWeeks,
  hitDegreeOf,
  isDown,
  woundOf,
} from '#services/rules/engine'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'

/** As in the rules specs: the engine module, never the barrel and its real dice. */
function buildEngine(faces: number[]) {
  return new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces)))
}

const RAPIER: Weapon = {
  reference: 'rapier',
  kind: 'melee',
  damage: '1D6+1',
  damageModifier: 'full',
  special: 'impaling',
}

const CLUB: Weapon = { ...RAPIER, reference: 'club', damage: '1D8', special: 'crushing' }
const SABRE: Weapon = { ...RAPIER, reference: 'sabre', damage: '1D8', special: 'bleeding' }
const WHIP: Weapon = { ...RAPIER, reference: 'whip', damage: '1D3', special: 'entangling' }

const SWORD: RollBase = { kind: 'skill', skill: 'swordsmanship', value: 60 }
const DODGE: RollBase = { kind: 'skill', skill: 'dodge', value: 30 }

test.group('Combat | attack and defence matrix', () => {
  /**
   * Every line of the book's matrix: attack degree, defence degree, the degree
   * the blow lands with — null when it is stopped or missed.
   */
  const matrix: [Degree, Degree | null, HitDegree | null][] = [
    ['critical', 'critical', null],
    ['critical', 'special', 'success'],
    ['critical', 'success', 'special'],
    ['critical', 'failure', 'critical'],
    ['critical', 'fumble', 'critical'],
    ['special', 'critical', null],
    ['special', 'special', null],
    ['special', 'success', 'success'],
    ['special', 'failure', 'special'],
    ['special', 'fumble', 'special'],
    ['success', 'critical', null],
    ['success', 'special', null],
    ['success', 'success', null],
    ['success', 'failure', 'success'],
    ['success', 'fumble', 'success'],
    ['success', null, 'success'],
    ['failure', null, null],
    ['fumble', null, null],
  ]

  for (const [attack, defense, landed] of matrix) {
    test(`a ${attack} attack against a ${defense ?? 'missing'} defence lands ${landed ?? 'nothing'}`, ({
      assert,
    }) => {
      assert.equal(hitDegreeOf(attack, defense), landed)
    })
  }
})

test.group('Combat | choosing the defence', () => {
  test('parry and dodge against a blow, dodge alone and difficult against a shot', ({ assert }) => {
    assert.deepEqual(
      defenseOptions('melee', { parry: SWORD, dodge: DODGE }).map(({ defense, difficulty }) => [
        defense,
        difficulty,
      ]),
      [
        ['parry', 'average'],
        ['dodge', 'average'],
      ]
    )
    assert.deepEqual(
      defenseOptions('projectile', { parry: SWORD, dodge: DODGE }).map(
        ({ defense, difficulty }) => [defense, difficulty]
      ),
      [['dodge', 'difficult']]
    )
  })

  test('a thrown weapon can be parried', ({ assert }) => {
    assert.lengthOf(defenseOptions('thrown', { parry: SWORD, dodge: DODGE }), 2)
  })

  test('what the scene rules out is not offered', ({ assert }) => {
    assert.deepEqual(
      defenseOptions('melee', { parry: null, dodge: DODGE }).map(({ defense }) => defense),
      ['dodge']
    )
    assert.isNull(bestDefense(defenseOptions('projectile', { parry: SWORD, dodge: null })))
  })

  test('the better chance is rolled, modifiers counted', ({ assert }) => {
    const options = defenseOptions('melee', { parry: SWORD, dodge: DODGE })

    assert.equal(bestDefense(options)?.defense, 'parry')
    assert.equal(
      bestDefense(defenseOptions('melee', { parry: DODGE, dodge: SWORD }))?.defense,
      'dodge'
    )
  })

  test('a tie goes to the parry', ({ assert }) => {
    const options = defenseOptions('melee', { parry: DODGE, dodge: DODGE })

    assert.equal(bestDefense(options)?.defense, 'parry')
  })
})

test.group('Combat | damage of a blow', () => {
  const hit = (weapon: Weapon, degree: HitDegree, damageModifier: string | null = '+1D4') => ({
    weapon,
    damageModifier,
    degree,
    armor: 1,
  })

  test('a success deals the weapon and the modifier, less armour, with no effect', ({ assert }) => {
    const resolution = buildEngine([4, 3]).resolveHit(hit(RAPIER, 'success'))

    assert.equal(resolution.total, 4 + 1 + 3 - 1)
    assert.isNull(resolution.effect)
    assert.isFalse(resolution.stopped)
    assert.isFalse(resolution.bleeding)
  })

  test('a critical deals the weapon at its most, through armour, with no effect', ({ assert }) => {
    const resolution = buildEngine([3]).resolveHit(hit(RAPIER, 'critical'))

    assert.equal(resolution.total, 7 + 3)
    assert.equal(resolution.armor, 0)
    assert.isNull(resolution.effect)
  })

  test('an impale doubles the weapon dice, not the modifier', ({ assert }) => {
    /** 4 + 1, then 2 + 1 on the rapier; 3 on the modifier; 1 stopped. */
    const resolution = buildEngine([4, 2, 3]).resolveHit(hit(RAPIER, 'special'))

    assert.equal(resolution.weapon, 8)
    assert.equal(resolution.modifier, 3)
    assert.equal(resolution.total, 10)
    assert.equal(resolution.effect, 'impaling')
    assert.isFalse(resolution.stopped)
  })

  test('a crushing blow doubles the modifier and stops the target', ({ assert }) => {
    /** 5 on the club, 2 and 4 on the doubled modifier, 1 stopped. */
    const resolution = buildEngine([5, 2, 4]).resolveHit(hit(CLUB, 'special'))

    assert.equal(resolution.modifier, 6)
    assert.equal(resolution.total, 10)
    assert.isTrue(resolution.stopped)
  })

  test('a crushing blow with no modifier adds 1D4, with a malus none', ({ assert }) => {
    assert.equal(buildEngine([5, 3]).resolveHit(hit(CLUB, 'special', null)).modifier, 3)
    /** A single face: the malus is not rolled at all. */
    assert.equal(buildEngine([5]).resolveHit(hit(CLUB, 'special', '-1D4')).modifier, 0)
  })

  test('a bleeding blow bleeds, an entangling one stops the target', ({ assert }) => {
    assert.isTrue(buildEngine([4, 2]).resolveHit(hit(SABRE, 'special')).bleeding)

    const entangled = buildEngine([2, 2]).resolveHit(hit(WHIP, 'special'))

    assert.isTrue(entangled.stopped)
    assert.isFalse(entangled.bleeding)
  })

  test('a firearm special never rolls the modifier', ({ assert }) => {
    const pistol: Weapon = { ...RAPIER, kind: 'projectile', damage: '1D8', damageModifier: 'none' }

    /** Two faces for the doubled dice, none for the modifier. */
    assert.equal(buildEngine([4, 5]).resolveHit(hit(pistol, 'special')).total, 4 + 5 - 1)
  })
})

test.group('Combat | wounds', () => {
  test('mortal at 0, serious at half the hit points in one blow, light otherwise', ({ assert }) => {
    assert.equal(woundOf(0, 24, 24), 'none')
    assert.equal(woundOf(11, 24, 13), 'light')
    assert.equal(woundOf(12, 24, 12), 'serious')
    assert.equal(woundOf(13, 25, 12), 'serious')
    assert.equal(woundOf(12, 25, 13), 'light')
    assert.equal(woundOf(5, 24, 0), 'mortal')
    assert.equal(woundOf(5, 24, -3), 'mortal')
  })

  test('down at 2 hit points or fewer', ({ assert }) => {
    assert.isTrue(isDown(2))
    assert.isTrue(isDown(0))
    assert.isFalse(isDown(3))
  })
})

test.group('Combat | fumbles', () => {
  const boundaries: [number, string][] = [
    [1, 'nothing'],
    [30, 'nothing'],
    [31, 'fall'],
    [55, 'fall'],
    [56, 'weapon_dropped'],
    [75, 'weapon_dropped'],
    [76, 'self_injury'],
    [90, 'self_injury'],
    [91, 'weapon_broken'],
    [100, 'weapon_broken'],
  ]

  for (const [roll, fumble] of boundaries) {
    test(`a ${roll} on the table is ${fumble}`, ({ assert }) => {
      assert.equal(fumbleOf(roll), fumble)
    })
  }

  test('an outcome that does not apply is nothing more than the failure', ({ assert }) => {
    const bare = { droppable: false, breakable: false }

    assert.equal(buildEngine([60]).rollFumble(bare), 'nothing')
    assert.equal(buildEngine([95]).rollFumble(bare), 'nothing')
    assert.equal(buildEngine([95]).rollFumble({ droppable: true, breakable: false }), 'nothing')
    assert.equal(
      buildEngine([60]).rollFumble({ droppable: true, breakable: false }),
      'weapon_dropped'
    )
  })

  test('a fumbler hurts themself with the weapon alone, through their armour', ({ assert }) => {
    assert.equal(buildEngine([5]).selfInjury(RAPIER, 2), 4)
    assert.equal(buildEngine([1]).selfInjury(RAPIER, 5), 0)
  })
})

test.group('Combat | healing', () => {
  test('first aid by its degree', ({ assert }) => {
    assert.equal(buildEngine([]).firstAid('fumble'), -1)
    assert.equal(buildEngine([]).firstAid('failure'), 0)
    assert.equal(buildEngine([2]).firstAid('success'), 2)
    assert.equal(buildEngine([2, 3]).firstAid('special'), 5)
    assert.equal(buildEngine([1]).firstAid('critical'), 4)
  })

  test('1D3 for each whole week of game time', ({ assert }) => {
    const week = 7 * 24 * 60 * 60

    assert.equal(healingWeeks(0, week - 1), 0)
    assert.equal(healingWeeks(0, week), 1)
    assert.equal(healingWeeks(100, 100 + 2 * week + 5), 2)
    assert.equal(buildEngine([2, 3]).naturalHealing(2), 5)
    assert.equal(buildEngine([]).naturalHealing(0), 0)
  })
})
