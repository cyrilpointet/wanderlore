import { randomUUID } from 'node:crypto'

import type TurnLog from '#models/turn_log'
import type { TurnService } from '#services/game/turn_service'

export type PlayInput = {
  sessionId: string
  userId: string
  playerInput: string
}

/**
 * Records a turn the way a submission does — a fresh key each time — then
 * plays it straight away, as the worker would, and returns it as logged.
 *
 * Skips the queue on purpose: these specs are about the pipeline. The queue
 * has specs of its own.
 */
export function playerOf(service: TurnService) {
  return async (input: PlayInput): Promise<TurnLog> => {
    const { turn } = await service.record({ ...input, idempotencyKey: randomUUID() })

    return service.run(turn.id)
  }
}
