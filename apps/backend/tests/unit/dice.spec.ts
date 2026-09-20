import { test } from '@japa/runner'

import { DiceService, SystemRandomSource } from '#services/dice'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'

/**
 * Unlike the LLM specs, importing the service module is safe here: building a
 * `SystemRandomSource` has no side effect, where `#services/llm` would
 * construct a real Gemini client.
 */

test.group('DiceService | 2d6', () => {
  test('keeps both dice and their sum', ({ assert }) => {
    const dice = new DiceService(FakeRandomSource.fromFaces([3, 5]))

    const roll = dice.roll2d6()

    /**
     * The two dice are what makes the roll traceable in the turn log: a total
     * of 8 does not say whether it came from 3+5 or 4+4.
     */
    assert.deepEqual(roll.dice, [3, 5])
    assert.equal(roll.total, 8)
  })

  test('draws the dice in order', ({ assert }) => {
    const dice = new DiceService(FakeRandomSource.fromFaces([1, 6]))

    assert.deepEqual(dice.roll2d6().dice, [1, 6])
  })

  test('asks the source for a six-sided bound, once per die', ({ assert }) => {
    const source = FakeRandomSource.fromFaces([2, 4])

    new DiceService(source).roll2d6()

    assert.deepEqual(source.calls, [6, 6])
  })

  test('reaches both extremes', ({ assert }) => {
    const lowest = new DiceService(FakeRandomSource.fromFaces([1, 1])).roll2d6()
    const highest = new DiceService(FakeRandomSource.fromFaces([6, 6])).roll2d6()

    assert.equal(lowest.total, 2)
    assert.equal(highest.total, 12)
  })
})

test.group('DiceService | face arithmetic', () => {
  /**
   * The source returns `0..5` while a die shows `1..6`. Sweeping every raw
   * value is what catches an off-by-one that a single roll would hide.
   */
  for (let value = 0; value < 6; value += 1) {
    test(`turns raw ${value} into face ${value + 1}`, ({ assert }) => {
      const dice = new DiceService(new FakeRandomSource([value]))

      assert.equal(dice.rollDie(), value + 1)
    })
  }
})

test.group('SystemRandomSource | bounds', () => {
  test('stays within a six-sided die and reaches every face', ({ assert }) => {
    const dice = new DiceService(new SystemRandomSource())
    const seen = new Set<number>()

    for (let roll = 0; roll < 2000; roll += 1) {
      for (const die of dice.roll2d6().dice) {
        assert.isAtLeast(die, 1)
        assert.isAtMost(die, 6)
        seen.add(die)
      }
    }

    /**
     * Not flaky: missing a face over 4000 draws has a probability around
     * 6 × (5/6)^4000.
     */
    assert.equal(seen.size, 6)
  })
})

test.group('FakeRandomSource | exhaustion', () => {
  test('throws rather than recycle its values', ({ assert }) => {
    const dice = new DiceService(FakeRandomSource.fromFaces([3]))

    /**
     * Guards the double itself: a spec that rolls more dice than it arranged
     * for must fail loudly instead of passing on values it never chose.
     */
    assert.throws(() => dice.roll2d6(), /ran out of values/)
  })
})
