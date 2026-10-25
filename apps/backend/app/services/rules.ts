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
  applyDifficulty,
  contextualValue,
  degreeOf,
  outcomeOf,
  toNarrationOutcome,
} from './rules/engine.js'
export {
  CHARACTERISTICS,
  CONTEXTUAL_EFFECTS,
  DAMAGE_MODIFIER_USES,
  DEGREES,
  DIFFICULTIES,
  SPECIAL_EFFECTS,
} from './rules/types.js'
export { itemModifiers } from './rules/modifiers.js'
export { baseChanceOf, damageModifierFor, hitPointsFor } from './rules/derived.js'
export { isDiceExpression, parseDice } from './rules/dice_expression.js'
export type {
  AppliedModifier,
  BaseChance,
  Characteristic,
  Characteristics,
  ContextualEffect,
  ContextualModifier,
  DamageModifierUse,
  DamageRequest,
  DamageResolution,
  Degree,
  Difficulty,
  ModifierSource,
  ModifierTarget,
  NarrationOutcome,
  RollBase,
  RollModifiers,
  RollOutcome,
  RollResolution,
  SpecialEffect,
} from './rules/types.js'
