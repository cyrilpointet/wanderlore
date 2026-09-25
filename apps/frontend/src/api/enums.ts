/**
 * The closed enums the backend sends. They are system values, finite and known
 * at compile time: the front owns their labels, in the `enums` translation
 * namespace (front spec, principle 2). Content references (skills, locations…)
 * are not here — their labels come from the backend.
 */
export const GAME_STATUSES = ['in_progress', 'paused', 'completed'] as const
export const TURN_STATUSES = ['pending', 'completed', 'failed'] as const
export const STEPS = ['arbitration', 'narration'] as const
export const RESULTS = ['success', 'failure'] as const
export const MARGINS = [
  'critical_success',
  'comfortable',
  'narrow',
  'minor_failure',
  'critical_failure',
] as const

export type GameStatus = (typeof GAME_STATUSES)[number]
export type TurnStatus = (typeof TURN_STATUSES)[number]
export type Step = (typeof STEPS)[number]
export type Result = (typeof RESULTS)[number]
export type Margin = (typeof MARGINS)[number]
