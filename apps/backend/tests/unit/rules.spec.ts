import { test } from '@japa/runner'

import { DiceService } from '#services/dice'
import type { Difficulty, MarginLabel } from '#services/rules/types'
import {
  RulesEngine,
  qualifyMargin,
  thresholdFor,
  toNarrationOutcome,
} from '#services/rules/engine'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'
import { itemModifiers } from '#services/rules/modifiers'
import { resolveDamage } from '#services/rules/damage'
import type { ModifierSource } from '#services/rules/types'

/**
 * These specs import the engine module, never `#services/rules`: the barrel
 * wires the real dice singleton, and a resolution has to be reproducible.
 */
function buildEngine(faces: number[]) {
  return new RulesEngine(new DiceService(FakeRandomSource.fromFaces(faces)))
}

test.group('RulesEngine | difficulty scale', () => {
  const scale: [Difficulty, number][] = [
    ['easy', 7],
    ['medium', 9],
    ['hard', 11],
    ['very_hard', 13],
  ]

  for (const [difficulty, threshold] of scale) {
    test(`${difficulty} is a threshold of ${threshold}`, ({ assert }) => {
      assert.equal(thresholdFor(difficulty), threshold)
    })
  }
})

test.group('RulesEngine | margin boundaries', () => {
  /**
   * Every boundary of the qualitative scale, taken from both sides — the value
   * that still belongs to a band and the first one that does not. A test on a
   * single margin per band would miss exactly the off-by-one that matters.
   */
  const boundaries: [number, MarginLabel][] = [
    [6, 'critical_success'],
    [5, 'critical_success'],
    [4, 'comfortable'],
    [1, 'comfortable'],
    [0, 'narrow'],
    [-1, 'minor_failure'],
    [-3, 'minor_failure'],
    [-4, 'critical_failure'],
    [-5, 'critical_failure'],
  ]

  for (const [margin, label] of boundaries) {
    test(`a margin of ${margin} reads as ${label}`, ({ assert }) => {
      assert.equal(qualifyMargin(margin), label)
    })
  }

  test('a margin of zero is still a success', ({ assert }) => {
    const engine = buildEngine([4, 5])

    /**
     * 4 + 5 + 0 = 9 against the medium threshold of 9. Scraping through counts
     * as making it — that is what `narrow` means.
     */
    const resolution = engine.resolve(0, 'medium')

    assert.equal(resolution.margin, 0)
    assert.equal(resolution.result, 'success')
    assert.equal(resolution.marginLabel, 'narrow')
  })

  test('one point below the threshold fails', ({ assert }) => {
    const engine = buildEngine([4, 4])

    const resolution = engine.resolve(0, 'medium')

    assert.equal(resolution.margin, -1)
    assert.equal(resolution.result, 'failure')
    assert.equal(resolution.marginLabel, 'minor_failure')
  })
})

test.group('RulesEngine | resolution', () => {
  test('adds the skill value to the dice', ({ assert }) => {
    const engine = buildEngine([3, 5])

    const resolution = engine.resolve(2, 'medium')

    assert.equal(resolution.total, 10)
    assert.equal(resolution.skillValue, 2)
    assert.equal(resolution.threshold, 9)
    assert.equal(resolution.margin, 1)
    assert.equal(resolution.marginLabel, 'comfortable')
  })

  test('without modifiers, the total is the dice and the skill alone', ({ assert }) => {
    const resolution = buildEngine([3, 5]).resolve(2, 'medium')

    assert.deepEqual(resolution.appliedModifiers, [])
    assert.equal(resolution.total, 3 + 5 + 2)
  })

  test('keeps the dice for the turn log', ({ assert }) => {
    const engine = buildEngine([2, 6])

    /**
     * The log records what was rolled: a total of 8 does not say whether it
     * came from 2+6 or 4+4.
     */
    assert.deepEqual(engine.resolve(0, 'easy').dice, [2, 6])
  })

  test('an expert can still miss a very hard action', ({ assert }) => {
    const engine = buildEngine([1, 1])

    const resolution = engine.resolve(5, 'very_hard')

    assert.equal(resolution.total, 7)
    assert.equal(resolution.margin, -6)
    assert.equal(resolution.result, 'failure')
    assert.equal(resolution.marginLabel, 'critical_failure')
  })

  test('the same roll resolves differently per difficulty', ({ assert }) => {
    const easy = buildEngine([4, 4]).resolve(1, 'easy')
    const hard = buildEngine([4, 4]).resolve(1, 'hard')

    assert.equal(easy.result, 'success')
    assert.equal(hard.result, 'failure')
  })
})

test.group('RulesEngine | narration boundary', () => {
  test('hands the narrator a verdict and nothing mechanical', ({ assert }) => {
    const resolution = buildEngine([6, 6]).resolve(3, 'easy')

    const outcome = toNarrationOutcome(resolution)

    /**
     * Guards an invariant, not an implementation detail: given the dice, the
     * threshold or the skill value, the narrator would try to justify or
     * contradict the numbers instead of telling the story.
     */
    assert.deepEqual(Object.keys(outcome).sort(), ['margin', 'result'])
    assert.equal(outcome.result, 'success')
    assert.equal(outcome.margin, 'critical_success')
  })
})

const RAPIER: ModifierSource = {
  reference: 'rapier',
  equipped: true,
  modifiers: [
    { target: 'skill', skill: 'swordsmanship', value: 1, condition: 'equipped' },
    { target: 'damage', value: 2, condition: 'equipped' },
  ],
}

const LETTER: ModifierSource = {
  reference: 'letter_to_treville',
  equipped: false,
  modifiers: [{ target: 'skill', skill: 'persuasion', value: 1, condition: 'owned' }],
}

const MUSKET: ModifierSource = {
  reference: 'musket',
  equipped: true,
  modifiers: [
    { target: 'damage', value: 4, condition: 'equipped' },
    { target: 'skill', skill: 'stealth', value: -1, condition: 'equipped' },
  ],
}

test.group('Rules | item modifiers', () => {
  test('an owned item counts as soon as it is held', ({ assert }) => {
    assert.deepEqual(itemModifiers([LETTER], { target: 'skill', skill: 'persuasion' }), [
      { source: 'item', origin: 'letter_to_treville', value: 1 },
    ])
  })

  test('an equipped modifier counts only while the item is equipped', ({ assert }) => {
    const sheathed = { ...RAPIER, equipped: false }

    assert.lengthOf(itemModifiers([sheathed], { target: 'skill', skill: 'swordsmanship' }), 0)
    assert.deepEqual(itemModifiers([RAPIER], { target: 'skill', skill: 'swordsmanship' }), [
      { source: 'item', origin: 'rapier', value: 1 },
    ])
  })

  test('only what aims at the target counts', ({ assert }) => {
    const sources = [RAPIER, LETTER, MUSKET]

    assert.deepEqual(itemModifiers(sources, { target: 'skill', skill: 'stealth' }), [
      { source: 'item', origin: 'musket', value: -1 },
    ])
    assert.deepEqual(itemModifiers(sources, { target: 'skill', skill: 'etiquette' }), [])
    /** A damage bonus never moves a roll, a skill modifier never adds damage. */
    assert.deepEqual(
      itemModifiers(sources, { target: 'damage' }).map((modifier) => modifier.origin),
      ['rapier', 'musket']
    )
  })

  test('a definition counts once, however many copies are held', ({ assert }) => {
    const spare = { ...RAPIER, equipped: false }

    assert.deepEqual(itemModifiers([spare, RAPIER, spare], { target: 'damage' }), [
      { source: 'item', origin: 'rapier', value: 2 },
    ])
  })
})

test.group('Rules | damage', () => {
  /** The hit itself: half the margin, rounded up, at least one. */
  const hits: [number, number][] = [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
  ]

  for (const [margin, hit] of hits) {
    test(`a margin of ${margin} hits for ${hit} bare-handed`, ({ assert }) => {
      assert.deepEqual(resolveDamage(margin, []), { hit, appliedModifiers: [], total: hit })
    })
  }

  test('the weapon adds its bonus to the hit', ({ assert }) => {
    /** The example of the rules: a rapier (+2) and a margin of +4 deal 2 + 2. */
    assert.deepEqual(resolveDamage(4, [RAPIER, LETTER]), {
      hit: 2,
      appliedModifiers: [{ source: 'item', origin: 'rapier', value: 2 }],
      total: 4,
    })
  })

  test('a weapon merely carried adds nothing', ({ assert }) => {
    assert.equal(resolveDamage(4, [{ ...RAPIER, equipped: false }]).total, 2)
  })

  test('a failed attack is no hit at all', ({ assert }) => {
    assert.throws(() => resolveDamage(-1, [RAPIER]), RangeError)
  })
})

test.group('RulesEngine | modifiers', () => {
  test('prices each circumstance from its label', ({ assert }) => {
    const resolution = buildEngine([3, 3]).resolve(2, 'medium', {
      skill: 'persuasion',
      contextual: [
        { source: 'favorable_reputation', effect: 'major_bonus' },
        { source: 'late_hour', effect: 'minor_bonus' },
        { source: 'unsuitable_attire', effect: 'major_penalty' },
      ],
      items: [],
    })

    assert.deepEqual(resolution.appliedModifiers, [
      { source: 'contextual', origin: 'favorable_reputation', value: 2 },
      { source: 'contextual', origin: 'late_hour', value: 1 },
      { source: 'contextual', origin: 'unsuitable_attire', value: -2 },
    ])
    assert.equal(resolution.total, 3 + 3 + 2 + 1)
  })

  test('keeps the two families apart, and both move the total and the margin', ({ assert }) => {
    /** 4 + 2 + 3 = 9, a narrow success bare; +1 (circumstance) +1 (letter) = 11. */
    const resolution = buildEngine([4, 2]).resolve(3, 'medium', {
      skill: 'persuasion',
      contextual: [{ source: 'favorable_reputation', effect: 'minor_bonus' }],
      items: [LETTER, RAPIER],
    })

    assert.deepEqual(resolution.appliedModifiers, [
      { source: 'contextual', origin: 'favorable_reputation', value: 1 },
      { source: 'item', origin: 'letter_to_treville', value: 1 },
    ])
    assert.equal(resolution.total, 11)
    assert.equal(resolution.margin, 2)
    assert.equal(resolution.marginLabel, 'comfortable')
  })

  test('reads the item modifiers against the skill rolled', ({ assert }) => {
    const sword = buildEngine([4, 4]).resolve(2, 'hard', {
      skill: 'swordsmanship',
      contextual: [],
      items: [RAPIER, LETTER],
    })
    const sheathed = buildEngine([4, 4]).resolve(2, 'hard', {
      skill: 'swordsmanship',
      contextual: [],
      items: [{ ...RAPIER, equipped: false }],
    })

    /** The rapier's damage bonus never weighs on the roll itself. */
    assert.deepEqual(sword.appliedModifiers, [{ source: 'item', origin: 'rapier', value: 1 }])
    assert.deepEqual(sheathed.appliedModifiers, [])
  })

  test('a malus lowers the total', ({ assert }) => {
    const resolution = buildEngine([5, 5]).resolve(1, 'medium', {
      skill: 'stealth',
      contextual: [],
      items: [MUSKET],
    })

    assert.equal(resolution.total, 10)
  })

  test('never takes more than three circumstances', ({ assert }) => {
    const four = Array.from({ length: 4 }, (_, index) => ({
      source: `circumstance_${index}`,
      effect: 'minor_bonus' as const,
    }))

    assert.throws(
      () =>
        buildEngine([3, 3]).resolve(0, 'easy', { skill: 'athletics', contextual: four, items: [] }),
      RangeError
    )
  })

  test('the narrator still only learns the result and the margin label', ({ assert }) => {
    const resolution = buildEngine([6, 6]).resolve(3, 'easy', {
      skill: 'persuasion',
      contextual: [{ source: 'favorable_reputation', effect: 'major_bonus' }],
      items: [LETTER],
    })

    assert.deepEqual(toNarrationOutcome(resolution), {
      result: 'success',
      margin: 'critical_success',
    })
  })
})
