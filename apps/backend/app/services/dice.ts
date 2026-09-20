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

const DIE_FACES = 6

/**
 * Both dice are kept, not just their sum: the turn log records what was rolled,
 * and a total of 8 does not say whether it came from 4+4 or 6+2.
 */
export type DiceRoll = {
  dice: [number, number]
  total: number
}

/**
 * Rolls dice, and nothing else.
 *
 * Thresholds, margins and modifiers belong to the rules engine — this service
 * has no notion of success or difficulty.
 */
export class DiceService {
  #source: RandomSource

  constructor(source: RandomSource) {
    this.#source = source
  }

  rollDie(): number {
    return this.#source.nextInt(DIE_FACES) + 1
  }

  roll2d6(): DiceRoll {
    const dice: [number, number] = [this.rollDie(), this.rollDie()]

    return { dice, total: dice[0] + dice[1] }
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
