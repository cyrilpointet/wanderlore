/**
 * Raised when two turns of the same game race each other.
 *
 * A turn spends seconds waiting on the model between reading the last turn
 * number and writing the next one, so two submissions a moment apart both
 * compute the same number and the second one loses. One player double-sending
 * is enough — this needs no second player.
 *
 * The unique constraint on `(session_id, turn_number)` is what catches it, and
 * it stays the last line of defence whatever serialisation is added upstream.
 */
export class ConcurrentTurnError extends Error {
  readonly turnNumber: number

  constructor(turnNumber: number) {
    super(`Turn ${turnNumber} of this game was already written by another request.`)
    this.name = 'ConcurrentTurnError'
    this.turnNumber = turnNumber
  }
}

/**
 * The turn was recorded but could not be put in the queue, so nothing will
 * ever play it. It is marked failed on the spot rather than left pending.
 */
export class QueueUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('The turn could not be queued.', options)
    this.name = 'QueueUnavailableError'
  }
}

/**
 * The turn stopped being pending while it was being played — expired by the
 * sweep, most likely. Whatever it produced is dropped: its outcome was already
 * settled, and overwriting it would tell the player two different stories.
 */
export class StaleTurnError extends Error {
  readonly turnId: string

  constructor(turnId: string) {
    super(`Turn ${turnId} is no longer pending; its outcome is discarded.`)
    this.name = 'StaleTurnError'
    this.turnId = turnId
  }
}

const PG_UNIQUE_VIOLATION = '23505'
const TURN_NUMBER_CONSTRAINT = 'turn_log_session_id_turn_number_unique'

/**
 * Recognises the collision by its constraint rather than by message text, which
 * is locale- and version-dependent.
 */
export function isTurnNumberConflict(error: unknown): boolean {
  const candidate = error as { code?: string; constraint?: string }

  return candidate?.code === PG_UNIQUE_VIOLATION && candidate?.constraint === TURN_NUMBER_CONSTRAINT
}
