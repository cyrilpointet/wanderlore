import llm from '#services/llm'
import rules from '#services/rules'

import { TurnService } from './game/turn_service.js'

/**
 * Application-wide turn service.
 *
 * Import this from application code:
 *
 * ```ts
 * import turns from '#services/turn'
 * ```
 *
 * Tests build their own `new TurnService(gateway, engine)` around a fake
 * provider and a fake random source — importing this barrel would construct a
 * real Gemini client.
 */
const turns = new TurnService(llm, rules)

export default turns

export { DEFAULT_LANGUAGE, TurnService } from './game/turn_service.js'
export type { SubmittedTurn, TurnSubmission } from './game/turn_service.js'
