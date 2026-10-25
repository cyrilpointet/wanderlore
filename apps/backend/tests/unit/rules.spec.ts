import { test } from '@japa/runner'

import { DiceService } from '#services/dice'
import type { Characteristics, Degree, ModifierSource, RollBase } from '#services/rules/types'
import {
  RulesEngine,
  applyDifficulty,
  contextualValue,
  degreeOf,
  toNarrationOutcome,
} from '#services/rules/engine'
import { itemModifiers } from '#services/rules/modifiers'
import { baseChanceOf, damageModifierFor, hitPointsFor } from '#services/rules/derived'
import { isDiceExpression, maximumOf, parseDice } from '#services/rules/dice_expression'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'

/**
 * These specs import the engine module, never `#services/rules`: the barrel
 * wires the real dice singleton, and a resolution has to be reproducible.
 */
function buildEngine(faces: number[]) {
  return new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces)))
}

const SWORD: RollBase = { kind: 'skill', skill: 'sword', value: 55 }

const AVERAGE_ADULT: Characteristics = {
  STR: 13,
  CON: 13,
  SIZ: 12,
  INT: 14,
  POW: 11,
  DEX: 12,
  CHA: 10,
}

test.group('Rules | difficulty', () => {
  test('easy doubles the base, average keeps it', ({ assert }) => {
    assert.equal(applyDifficulty(55, 'easy'), 110)
    assert.equal(applyDifficulty(55, 'average'), 55)
  })

  test('difficult halves the base, rounded up', ({ assert }) => {
    assert.equal(applyDifficulty(55, 'difficult'), 28)
    assert.equal(applyDifficulty(54, 'difficult'), 27)
  })
})

test.group('Rules | degrees', () => {
  /**
   * Every boundary, taken from both sides — the roll that still belongs to a
   * degree and the first one that does not. A test on a single roll per
   * degree would miss exactly the off-by-one that matters.
   */
  const boundaries: [number, number, Degree][] = [
    /** 50%: critical up to 3 (2.5 rounded up), special up to 10, fumble 98–00. */
    [3, 50, 'critical'],
    [4, 50, 'special'],
    [10, 50, 'special'],
    [11, 50, 'success'],
    [50, 50, 'success'],
    [51, 50, 'failure'],
    [97, 50, 'failure'],
    [98, 50, 'fumble'],
    [100, 50, 'fumble'],
    /** 75%: critical up to 4, special up to 15, fumble 99–00. */
    [4, 75, 'critical'],
    [5, 75, 'special'],
    [15, 75, 'special'],
    [16, 75, 'success'],
    [98, 75, 'failure'],
    [99, 75, 'fumble'],
    /** 20%: critical on 01 alone, fumble 97–00. */
    [1, 20, 'critical'],
    [2, 20, 'special'],
    [4, 20, 'special'],
    [5, 20, 'success'],
    [96, 20, 'failure'],
    [97, 20, 'fumble'],
  ]

  for (const [roll, chance, degree] of boundaries) {
    test(`a ${roll} against ${chance}% is a ${degree}`, ({ assert }) => {
      assert.equal(degreeOf(roll, chance), degree)
    })
  }

  test('01 to 05 always succeeds, however low the chance', ({ assert }) => {
    assert.equal(degreeOf(1, 0), 'critical')
    assert.equal(degreeOf(5, -30), 'success')
    assert.equal(degreeOf(6, 0), 'failure')
    /** With the chance floored at 5, the failure range is 06–00 and its top twentieth 96–00. */
    assert.equal(degreeOf(95, 0), 'failure')
    assert.equal(degreeOf(96, 0), 'fumble')
  })

  test('96 to 00 always fails, however high the chance', ({ assert }) => {
    assert.equal(degreeOf(95, 150), 'success')
    assert.equal(degreeOf(96, 150), 'failure')
    assert.equal(degreeOf(99, 150), 'failure')
    /** Only 00 is a fumble once the chance reaches 95. */
    assert.equal(degreeOf(100, 150), 'fumble')
  })

  test('a chance past 100 widens critical and special', ({ assert }) => {
    /** 150%: critical up to 8 (7.5 rounded up), special up to 30. */
    assert.equal(degreeOf(8, 150), 'critical')
    assert.equal(degreeOf(9, 150), 'special')
    assert.equal(degreeOf(30, 150), 'special')
    assert.equal(degreeOf(31, 150), 'success')
  })
})

test.group('RulesEngine | resolution', () => {
  test('rolls a skill against its value', ({ assert }) => {
    const resolution = buildEngine([42]).resolve(SWORD, 'average')

    assert.deepEqual(resolution, {
      base: SWORD,
      baseChance: 55,
      difficulty: 'average',
      appliedModifiers: [],
      chance: 55,
      roll: 42,
      result: 'success',
      degree: 'success',
    })
  })

  test('the same roll resolves differently per difficulty', ({ assert }) => {
    const easy = buildEngine([70]).resolve(SWORD, 'easy')
    const difficult = buildEngine([70]).resolve(SWORD, 'difficult')

    assert.equal(easy.chance, 110)
    assert.equal(easy.result, 'success')
    assert.equal(difficult.chance, 28)
    assert.equal(difficult.result, 'failure')
  })

  test('a characteristic is rolled at five times its score', ({ assert }) => {
    const agility: RollBase = { kind: 'characteristic', characteristic: 'DEX', value: 12 }

    const average = buildEngine([60]).resolve(agility, 'average')
    const easy = buildEngine([60]).resolve(agility, 'easy')
    const difficult = buildEngine([60]).resolve(agility, 'difficult')

    assert.equal(average.baseChance, 60)
    assert.equal(average.degree, 'success')
    /** Easy is ten times the score, difficult two and a half, rounded up. */
    assert.equal(easy.chance, 120)
    assert.equal(difficult.chance, 30)
    assert.equal(difficult.result, 'failure')
  })

  test('an expert can still fumble', ({ assert }) => {
    const master: RollBase = { kind: 'skill', skill: 'sword', value: 90 }

    assert.equal(buildEngine([100]).resolve(master, 'easy').degree, 'fumble')
  })
})

test.group('RulesEngine | narration boundary', () => {
  test('hands the narrator a verdict and nothing mechanical', ({ assert }) => {
    const resolution = buildEngine([2]).resolve(SWORD, 'average', {
      contextual: [{ source: 'favorable_reputation', effect: 'major_bonus' }],
      items: [],
    })

    const outcome = toNarrationOutcome(resolution)

    /**
     * Guards an invariant, not an implementation detail: given the dice, the
     * chance or the skill value, the narrator would try to justify or
     * contradict the numbers instead of telling the story.
     */
    assert.deepEqual(outcome, { result: 'success', degree: 'critical' })
  })
})

const LOCKPICKS: ModifierSource = {
  reference: 'lockpicks',
  equipped: true,
  modifiers: [{ target: 'skill', skill: 'fine_manipulation', value: 20, condition: 'equipped' }],
}

const LETTER: ModifierSource = {
  reference: 'letter_to_treville',
  equipped: false,
  modifiers: [{ target: 'skill', skill: 'persuade', value: 20, condition: 'owned' }],
}

const ARMOUR: ModifierSource = {
  reference: 'cuirass',
  equipped: true,
  modifiers: [
    { target: 'skill', skill: 'stealth', value: -20, condition: 'equipped' },
    { target: 'skill', skill: 'climb', value: -10, condition: 'equipped' },
  ],
}

test.group('Rules | item modifiers', () => {
  test('an owned item counts as soon as it is held', ({ assert }) => {
    assert.deepEqual(itemModifiers([LETTER], { target: 'skill', skill: 'persuade' }), [
      { source: 'item', origin: 'letter_to_treville', value: 20 },
    ])
  })

  test('an equipped modifier counts only while the item is equipped', ({ assert }) => {
    const pocketed = { ...LOCKPICKS, equipped: false }
    const target = { target: 'skill', skill: 'fine_manipulation' } as const

    assert.lengthOf(itemModifiers([pocketed], target), 0)
    assert.deepEqual(itemModifiers([LOCKPICKS], target), [
      { source: 'item', origin: 'lockpicks', value: 20 },
    ])
  })

  test('only what aims at the skill counts', ({ assert }) => {
    const sources = [LOCKPICKS, LETTER, ARMOUR]

    assert.deepEqual(itemModifiers(sources, { target: 'skill', skill: 'stealth' }), [
      { source: 'item', origin: 'cuirass', value: -20 },
    ])
    assert.deepEqual(itemModifiers(sources, { target: 'skill', skill: 'etiquette' }), [])
  })

  test('a definition counts once, however many copies are held', ({ assert }) => {
    const spare = { ...LOCKPICKS, equipped: false }

    assert.deepEqual(
      itemModifiers([spare, LOCKPICKS, spare], { target: 'skill', skill: 'fine_manipulation' }),
      [{ source: 'item', origin: 'lockpicks', value: 20 }]
    )
  })
})

test.group('RulesEngine | modifiers', () => {
  test('prices each circumstance from its label', ({ assert }) => {
    assert.equal(contextualValue('major_bonus'), 20)
    assert.equal(contextualValue('minor_bonus'), 10)
    assert.equal(contextualValue('minor_penalty'), -10)
    assert.equal(contextualValue('major_penalty'), -20)

    const resolution = buildEngine([50]).resolve(SWORD, 'average', {
      contextual: [
        { source: 'favorable_reputation', effect: 'major_bonus' },
        { source: 'late_hour', effect: 'minor_bonus' },
        { source: 'unsuitable_attire', effect: 'major_penalty' },
      ],
      items: [],
    })

    assert.deepEqual(resolution.appliedModifiers, [
      { source: 'contextual', origin: 'favorable_reputation', value: 20 },
      { source: 'contextual', origin: 'late_hour', value: 10 },
      { source: 'contextual', origin: 'unsuitable_attire', value: -20 },
    ])
    assert.equal(resolution.chance, 55 + 20 + 10 - 20)
  })

  test('modifiers are added after difficulty, never halved with it', ({ assert }) => {
    const base: RollBase = { kind: 'skill', skill: 'persuade', value: 30 }

    const resolution = buildEngine([30]).resolve(base, 'difficult', {
      contextual: [{ source: 'favorable_reputation', effect: 'major_bonus' }],
      items: [],
    })

    /** 30 halved is 15, then +20: 35 — not (30 + 20) ÷ 2. */
    assert.equal(resolution.chance, 35)
    assert.equal(resolution.result, 'success')
  })

  test('keeps the two families apart, both moving the chance', ({ assert }) => {
    const base: RollBase = { kind: 'skill', skill: 'persuade', value: 40 }

    const resolution = buildEngine([75]).resolve(base, 'average', {
      contextual: [{ source: 'favorable_reputation', effect: 'minor_bonus' }],
      items: [LETTER, LOCKPICKS],
    })

    assert.deepEqual(resolution.appliedModifiers, [
      { source: 'contextual', origin: 'favorable_reputation', value: 10 },
      { source: 'item', origin: 'letter_to_treville', value: 20 },
    ])
    assert.equal(resolution.chance, 70)
    assert.equal(resolution.result, 'failure')
  })

  test('a characteristic roll reads no item', ({ assert }) => {
    const luck: RollBase = { kind: 'characteristic', characteristic: 'POW', value: 11 }

    const resolution = buildEngine([10]).resolve(luck, 'average', {
      contextual: [],
      items: [LETTER, LOCKPICKS, ARMOUR],
    })

    assert.deepEqual(resolution.appliedModifiers, [])
  })

  test('never takes more than three circumstances', ({ assert }) => {
    const four = Array.from({ length: 4 }, (_, index) => ({
      source: `circumstance_${index}`,
      effect: 'minor_bonus' as const,
    }))

    assert.throws(
      () => buildEngine([50]).resolve(SWORD, 'easy', { contextual: four, items: [] }),
      RangeError
    )
  })
})

test.group('Rules | derived values', () => {
  test('hit points are half of CON + SIZ, rounded up', ({ assert }) => {
    assert.equal(hitPointsFor(AVERAGE_ADULT), 13)
    assert.equal(hitPointsFor({ ...AVERAGE_ADULT, CON: 14 }), 13)
  })

  test('a base chance is fixed, or a multiple of a characteristic', ({ assert }) => {
    assert.equal(baseChanceOf(25, AVERAGE_ADULT), 25)
    assert.equal(baseChanceOf({ characteristic: 'DEX', multiplier: 2 }, AVERAGE_ADULT), 24)
  })

  /** Every boundary of the table, by STR + SIZ. */
  const modifiers: [number, string | null][] = [
    [12, '-1D6'],
    [13, '-1D4'],
    [16, '-1D4'],
    [17, null],
    [24, null],
    [25, '+1D4'],
    [32, '+1D4'],
    [33, '+1D6'],
    [40, '+1D6'],
    [41, '+2D6'],
    [56, '+2D6'],
    [57, '+3D6'],
    [72, '+3D6'],
    [73, '+4D6'],
  ]

  for (const [total, modifier] of modifiers) {
    test(`STR + SIZ of ${total} gives a damage modifier of ${modifier ?? 'none'}`, ({ assert }) => {
      const strength = Math.floor(total / 2)

      assert.equal(
        damageModifierFor({ ...AVERAGE_ADULT, STR: strength, SIZ: total - strength }),
        modifier
      )
    })
  }
})

test.group('Rules | dice expressions', () => {
  test('parses what BRP writes', ({ assert }) => {
    assert.deepEqual(parseDice('1D6+1'), {
      dice: [{ count: 1, faces: 6, sign: 1 }],
      constant: 1,
    })
    assert.deepEqual(parseDice('-1d4'), { dice: [{ count: 1, faces: 4, sign: -1 }], constant: 0 })
    assert.deepEqual(parseDice('3D6+4'), { dice: [{ count: 3, faces: 6, sign: 1 }], constant: 4 })
    assert.isTrue(isDiceExpression('1D3-1'))
    assert.isTrue(isDiceExpression('+2D6'))
  })

  for (const invalid of ['', 'D6', '1D1', '0D6', '21D6', '1D6++1', 'abc', '1D6+', '1D101']) {
    test(`refuses "${invalid}"`, ({ assert }) => {
      assert.isFalse(isDiceExpression(invalid))
    })
  }

  test('takes the highest an expression can roll', ({ assert }) => {
    assert.equal(maximumOf(parseDice('1D6+1')), 7)
    assert.equal(maximumOf(parseDice('2D6')), 12)
    assert.equal(maximumOf(parseDice('1D3-1')), 2)
    /** A malus die at its best costs a single point. */
    assert.equal(maximumOf(parseDice('-1D4')), -1)
  })
})

test.group('RulesEngine | damage', () => {
  const RAPIER_HIT = {
    weaponDamage: '1D6+1',
    damageModifier: '+1D4',
    damageModifierUse: 'full' as const,
    armor: 2,
    critical: false,
  }

  test('weapon dice plus the damage modifier, minus armour', ({ assert }) => {
    /** 4 + 1 on the rapier, 3 on the modifier, 2 stopped: 6. */
    assert.deepEqual(buildEngine([4, 3]).resolveDamage(RAPIER_HIT), {
      weapon: 5,
      modifier: 3,
      armor: 2,
      total: 6,
    })
  })

  test('a thrown weapon adds half the modifier, rounded up', ({ assert }) => {
    const thrown = { ...RAPIER_HIT, damageModifierUse: 'half' as const, armor: 0 }

    assert.equal(buildEngine([4, 3]).resolveDamage(thrown).modifier, 2)
  })

  test('a firearm ignores the modifier, without rolling it', ({ assert }) => {
    const shot = { ...RAPIER_HIT, damageModifierUse: 'none' as const, armor: 0 }

    /** A single face arranged: rolling the modifier would run the source dry. */
    assert.equal(buildEngine([4]).resolveDamage(shot).total, 5)
  })

  test('a malus is kept whole, and damage never falls below zero', ({ assert }) => {
    const feeble = {
      weaponDamage: '1D3',
      damageModifier: '-1D4',
      damageModifierUse: 'half' as const,
      armor: 1,
      critical: false,
    }

    assert.deepEqual(buildEngine([1, 3]).resolveDamage(feeble), {
      weapon: 1,
      modifier: -3,
      armor: 0,
      total: 0,
    })
  })

  test('a critical hit deals the weapon at its most, and goes through armour', ({ assert }) => {
    /** Only the modifier is rolled: the rapier deals its 7. */
    assert.deepEqual(buildEngine([2]).resolveDamage({ ...RAPIER_HIT, critical: true }), {
      weapon: 7,
      modifier: 2,
      armor: 0,
      total: 9,
    })
  })

  test('a weapon with no damage modifier rolls its dice alone', ({ assert }) => {
    const bare = { ...RAPIER_HIT, damageModifier: null, armor: 0 }

    assert.equal(buildEngine([6]).resolveDamage(bare).total, 7)
  })
})
