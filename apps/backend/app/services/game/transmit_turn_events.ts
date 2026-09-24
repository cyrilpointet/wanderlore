import type { Logger } from '@adonisjs/core/logger'

import type { ContentLabels } from './content_labels.js'
import {
  type TurnEvent,
  type TurnEvents,
  type TurnRef,
  channelOf,
  toMessage,
} from './turn_events.js'

/** The one thing this adapter needs from Transmit. */
export type Broadcaster = {
  broadcast(channel: string, payload: Record<string, unknown>): void
}

/**
 * Turn events over SSE, through Transmit.
 *
 * In-memory transport: the job runs in the HTTP process, so the event reaches
 * the SSE connections of that same process directly. Several instances would
 * need Transmit's Redis transport (Phase 9).
 */
export class TransmitTurnEvents implements TurnEvents {
  #transmit: Broadcaster
  #labels: ContentLabels
  #logger: Logger

  constructor(transmit: Broadcaster, labels: ContentLabels, logger: Logger) {
    this.#transmit = transmit
    this.#labels = labels
    this.#logger = logger
  }

  emit(ref: TurnRef, event: TurnEvent): void {
    try {
      this.#transmit.broadcast(channelOf(ref.sessionId), toMessage(ref, event, this.#labels))
    } catch (error) {
      /** A lost event is caught up by reading the turn back; a lost turn is not. */
      this.#logger.error({ err: error, turnId: ref.turnId }, 'turn event not delivered')
    }
  }
}
