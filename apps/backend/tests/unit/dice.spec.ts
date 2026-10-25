import { test } from '@japa/runner'

import { DiceService, SystemRandomSource } from '#services/dice'
import { FakeRandomSource } from '#tests/helpers/fake_random_source'

/**
 * Unlike the LLM specs, importing the service module is safe here: building a
 * `SystemRandomSource` has no side effect, where `#services/llm` would
 * construct a real Gemini client.
 */

test.group('DiceService | d100', () => {
  test('rolls the face it was given', ({ assert }) => {
    assert.equal(new DiceService(FakeRandomSource.fromFaces([42])).rollD100(), 42)
  })

  test('asks the source for a hundred-sided bound', ({ assert }) => {
    const source = FakeRandomSource.fromFaces([7])

    new DiceService(source).rollD100()

    assert.deepEqual(source.calls, [100])
  })

  test('reaches both extremes: 01 and 00', ({ assert }) => {
    assert.equal(new DiceService(new FakeRandomSource([0])).rollD100(), 1)
    /** The "00" of the table is a hundred, the worst roll there is. */
    assert.equal(new DiceService(new FakeRandomSource([99])).rollD100(), 100)
  })
})

test.group('DiceService | any die', () => {
  /**
   * The source returns `0..faces - 1` while a die shows `1..faces`. Sweeping
   * every raw value of a d6 is what catches an off-by-one that a single roll
   * would hide.
   */
  for (let value = 0; value < 6; value += 1) {
    test(`turns raw ${value} into face ${value + 1}`, ({ assert }) => {
      const dice = new DiceService(new FakeRandomSource([value]))

      assert.equal(dice.rollDie(6), value + 1)
    })
  }

  test('asks the source for as many faces as the die has', ({ assert }) => {
    const source = FakeRandomSource.fromFaces([1, 1, 1])
    const dice = new DiceService(source)

    dice.rollDie(4)
    dice.rollDie(8)
    dice.rollDie(10)

    assert.deepEqual(source.calls, [4, 8, 10])
  })

  test('refuses a die without two faces', ({ assert }) => {
    const dice = new DiceService(FakeRandomSource.fromFaces([1]))

    assert.throws(() => dice.rollDie(1), RangeError)
    assert.throws(() => dice.rollDie(2.5), RangeError)
  })
})

test.group('SystemRandomSource | bounds', () => {
  test('stays within a d100 and reaches both ends', ({ assert }) => {
    const dice = new DiceService(new SystemRandomSource())
    const seen = new Set<number>()

    for (let roll = 0; roll < 20000; roll += 1) {
      const face = dice.rollD100()

      assert.isAtLeast(face, 1)
      assert.isAtMost(face, 100)
      seen.add(face)
    }

    /**
     * Not flaky: missing a given face over 20000 draws has a probability
     * around (99/100)^20000, below 10^-87.
     */
    assert.isTrue(seen.has(1))
    assert.isTrue(seen.has(100))
  })
})

test.group('FakeRandomSource | exhaustion', () => {
  test('throws rather than recycle its values', ({ assert }) => {
    const dice = new DiceService(FakeRandomSource.fromFaces([3]))

    dice.rollD100()

    /**
     * Guards the double itself: a spec that rolls more dice than it arranged
     * for must fail loudly instead of passing on values it never chose.
     */
    assert.throws(() => dice.rollD100(), /ran out of values/)
  })
})
