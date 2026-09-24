import llm from '#services/llm'
import rules from '#services/rules'
import queue from '#services/queue'

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
 * Tests build their own `new TurnService(gateway, engine, queue)` around a fake
 * provider, a fake random source and an in-memory queue — importing this barrel would construct a
 * real Gemini client.
 */
const turns = new TurnService(llm, rules, queue)

export default turns

export { DEFAULT_LANGUAGE, PLAY_TURN_QUEUE, TurnService } from './game/turn_service.js'
export type { PlayTurnJob, SubmittedTurn, TurnSubmission } from './game/turn_service.js'
