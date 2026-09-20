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
