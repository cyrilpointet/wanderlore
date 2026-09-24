import logger from '@adonisjs/core/services/logger'
import transmit from '@adonisjs/transmit/services/main'

import { ContentLabels } from './game/content_labels.js'
import { TransmitTurnEvents } from './game/transmit_turn_events.js'
import { THREE_MUSKETEERS } from './game/world.js'

/**
 * Application-wide turn events, sent over SSE.
 *
 * ```ts
 * import turnEvents from '#services/turn_events'
 * ```
 *
 * Tests hand the turn service a recorder of their own instead, and assert on
 * the sequence without Transmit.
 */
const turnEvents = new TransmitTurnEvents(
  {
    /**
     * Round-tripped through JSON, which is what goes over the wire anyway:
     * it narrows the payload to what Transmit accepts, dates included.
     */
    broadcast: (channel, payload) =>
      transmit.broadcast(channel, JSON.parse(JSON.stringify(payload))),
  },
  /** One world until Phase 5, where the session names its own. */
  new ContentLabels(THREE_MUSKETEERS),
  logger
)

export default turnEvents

export { channelOf } from './game/turn_events.js'
export type { TurnEvent, TurnEvents, TurnRef } from './game/turn_events.js'
