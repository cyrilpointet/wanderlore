import dice from '#services/dice'

import { RulesEngine } from './rules/engine.js'

/**
 * Application-wide rules engine.
 *
 * Import this, never the dice service directly:
 *
 * ```ts
 * import rules from '#services/rules'
 * ```
 *
 * A test builds its own `new RulesEngine(new DiceService(fakeSource))` so a
 * roll can be forced without global state.
 */
const rules = new RulesEngine(dice)

export default rules

export { qualifyMargin, thresholdFor, toNarrationOutcome } from './rules/engine.js'
export type {
  Difficulty,
  MarginLabel,
  NarrationOutcome,
  RollOutcome,
  RollResolution,
} from './rules/types.js'
