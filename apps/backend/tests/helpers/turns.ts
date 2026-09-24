import { randomUUID } from 'node:crypto'

import type TurnLog from '#models/turn_log'
import type { TurnService } from '#services/game/turn_service'

export type PlayInput = {
  sessionId: string
  userId: string
  playerInput: string
}

/**
 * Submits a turn the way the front does — a fresh key per submission — and
 * returns it as logged.
 */
export function playerOf(service: TurnService) {
  return async (input: PlayInput): Promise<TurnLog> => {
    const { turn } = await service.submit({ ...input, idempotencyKey: randomUUID() })

    return turn
  }
}
