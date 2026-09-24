import type { TurnEvent, TurnEvents, TurnRef } from '#services/game/turn_events'

export type RecordedEvent = {
  ref: TurnRef
  event: TurnEvent
}

/**
 * Turn events captured in memory instead of sent over SSE, so a spec can assert
 * on the sequence without Transmit.
 */
export class RecordingTurnEvents implements TurnEvents {
  readonly recorded: RecordedEvent[] = []

  emit(ref: TurnRef, event: TurnEvent): void {
    this.recorded.push({ ref, event })
  }

  /** The sequence for one turn, as `type` or `type:step`. */
  sequenceOf(turnId: string): string[] {
    return this.recorded
      .filter(({ ref }) => ref.turnId === turnId)
      .map(({ event }) =>
        event.type === 'step_started' ? `${event.type}:${event.step}` : event.type
      )
  }
}
