import type { RandomSource } from '#services/dice'

/**
 * Test double for the `RandomSource` port.
 *
 * It exists so a roll can be forced without touching anything global: a spec
 * builds its own `DiceService` around one of these. Beyond the dice specs it is
 * the seam the rules engine tests will build on.
 *
 * It **must** throw once its queue is exhausted rather than cycle: a spec that
 * rolls more dice than it arranged for is a broken spec, and recycling would
 * let it pass on values it never chose.
 */
export class FakeRandomSource implements RandomSource {
  /** Every bound received, in order — assert on what the service asks for. */
  readonly calls: number[] = []

  #values: number[]
  #index = 0

  /**
   * Takes the raw values `nextInt` must return, i.e. `0..maxExclusive - 1`.
   * For dice, prefer `fromFaces` — a spec reads in faces, not in indexes.
   */
  constructor(values: number[]) {
    this.#values = values
  }

  /**
   * Builds a source that yields the given die faces, 1 through 6.
   */
  static fromFaces(faces: number[]): FakeRandomSource {
    return new FakeRandomSource(faces.map((face) => face - 1))
  }

  nextInt(maxExclusive: number): number {
    this.calls.push(maxExclusive)

    if (this.#index >= this.#values.length) {
      throw new Error(
        `FakeRandomSource ran out of values after ${this.#values.length} call(s). ` +
          'Arrange as many values as the code under test consumes.'
      )
    }

    const value = this.#values[this.#index]
    this.#index += 1

    return value
  }
}
