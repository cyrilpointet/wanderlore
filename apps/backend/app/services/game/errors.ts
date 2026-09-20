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
