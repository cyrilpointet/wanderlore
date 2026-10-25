import { randomInt } from 'node:crypto'

/**
 * Port for the randomness a roll consumes.
 *
 * Deliberately lower level than "roll a die": the bound is what a test double
 * needs to control, and keeping the die itself in `DiceService` means the
 * faces-versus-index arithmetic lives in one place and is covered once.
 */
export interface RandomSource {
  /** Uniform integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number
}

/**
 * The real source.
 *
 * `randomInt` rather than `Math.random`: it returns a uniform integer over a
 * bound directly, with no modulo bias and no rounding to get wrong.
 */
export class SystemRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive)
  }
}

const D100_FACES = 100

/**
 * Rolls dice, and nothing else.
 *
 * Chances, degrees and modifiers belong to the rules engine — this service
 * has no notion of success or difficulty.
 */
export class DiceService {
  #source: RandomSource

  constructor(source: RandomSource) {
    this.#source = source
  }

  /** One die of `faces` sides, 1 to `faces`. */
  rollDie(faces: number): number {
    if (!Number.isInteger(faces) || faces < 2) {
      throw new RangeError(`A die has at least two faces, not ${faces}.`)
    }

    return this.#source.nextInt(faces) + 1
  }

  /** The percentile roll of BRP: 1 to 100, where 100 is the "00" of the table. */
  rollD100(): number {
    return this.rollDie(D100_FACES)
  }
}

/**
 * Application-wide dice instance.
 *
 * Import this in application code:
 *
 * ```ts
 * import dice from '#services/dice'
 * ```
 *
 * A test builds its own `new DiceService(fakeSource)` instead, so forcing a
 * result never goes through global state.
 */
const dice = new DiceService(new SystemRandomSource())

export default dice
