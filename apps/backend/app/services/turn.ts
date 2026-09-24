import llm from '#services/llm'
import rules from '#services/rules'
import queue from '#services/queue'
import turnEvents from '#services/turn_events'

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
 * Tests build their own `new TurnService(gateway, engine, queue, events)` around a
 * fake provider, a fake random source, an in-memory queue and an event recorder — importing this barrel would construct a
 * real Gemini client.
 */
const turns = new TurnService(llm, rules, queue, turnEvents)

export default turns

export { DEFAULT_LANGUAGE, PLAY_TURN_QUEUE, TurnService } from './game/turn_service.js'
export type { PlayTurnJob, SubmittedTurn, TurnSubmission } from './game/turn_service.js'
