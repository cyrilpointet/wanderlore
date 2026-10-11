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

export {
  MAX_CONTEXTUAL_MODIFIERS,
  contextualValue,
  qualifyMargin,
  thresholdFor,
  toNarrationOutcome,
} from './rules/engine.js'
export { CONTEXTUAL_EFFECTS } from './rules/types.js'
export { itemModifiers } from './rules/modifiers.js'
export { resolveDamage } from './rules/damage.js'
export type {
  AppliedModifier,
  ContextualEffect,
  ContextualModifier,
  DamageResolution,
  ModifierSource,
  ModifierTarget,
  Difficulty,
  MarginLabel,
  NarrationOutcome,
  RollModifiers,
  RollOutcome,
  RollResolution,
} from './rules/types.js'
