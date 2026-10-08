import type Character from '#models/character'
import type TurnLog from '#models/turn_log'
import type { MarginLabel, RollOutcome } from '#services/rules/types'
import type { ContentLabels, PlacedLocation } from '#services/game/content_labels'
import CharacterTransformer from '#transformers/character_transformer'
import TurnTransformer, { presentRoll } from '#transformers/turn_transformer'

/**
 * What the player is told about a turn while it plays: its milestones, and
 * the narration as it is written.
 *
 * Milestones only, not every technical step: the front turns them into waiting
 * messages, and an event it could not show would be noise. Emitted by the turn
 * code itself, never derived from the job queue's own events.
 */
export type TurnEvent =
  | { type: 'step_started'; step: 'arbitration' | 'narration' }
  /** The skill, the verdict and a qualitative margin — never the dice, the threshold or the skill value. */
  | { type: 'roll_resolved'; skill: string; result: RollOutcome; margin: MarginLabel }
  /**
   * A fragment of the narration as it is written, to append to what came
   * before. Provisional until `turn_completed`: the turn may still fail, and
   * fragments are never stored.
   */
  | { type: 'narration_chunk'; text: string }
  /**
   * Everything the journal, the sheet and the place badge need, so the front
   * makes no further request. There is no milestone for extraction: the
   * narration already shown stays provisional until this event says the turn
   * held.
   */
  | {
      type: 'turn_completed'
      turn: TurnLog
      character: Character
      location: PlacedLocation | null
    }
  | { type: 'turn_failed'; failure: { code: string; message: string } }

/**
 * Which turn an event belongs to. The idempotency key travels with it because
 * an event can reach the front before the `202` naming the turn does: the key,
 * which the front generated itself, is then all it can match on.
 */
export type TurnRef = {
  turnId: string
  sessionId: string
  idempotencyKey: string | null
}

/**
 * Port of the turn events. Emitting must never fail a turn: an event that
 * cannot be delivered is caught up by reading the turn back.
 */
export interface TurnEvents {
  emit(ref: TurnRef, event: TurnEvent): void
}

/** One channel per game, subscribed to before any submission. */
export function channelOf(sessionId: string): string {
  return `sessions/${sessionId}`
}

/**
 * The event as it goes over the wire: in the same shapes as the read routes,
 * so the front handles a turn one way whether it arrived live or was read back.
 */
export function toMessage(ref: TurnRef, event: TurnEvent, labels: ContentLabels) {
  const header = { event: event.type, turnId: ref.turnId, idempotencyKey: ref.idempotencyKey }

  switch (event.type) {
    case 'step_started':
      return { ...header, step: event.step }

    case 'roll_resolved':
      return { ...header, ...presentRoll(event, labels) }

    case 'narration_chunk':
      return { ...header, text: event.text }

    case 'turn_completed':
      return {
        ...header,
        turn: new TurnTransformer(event.turn, labels).toObject(),
        character: new CharacterTransformer(event.character, labels).toObject(),
        location: event.location === null ? null : labels.location(event.location),
      }

    case 'turn_failed':
      return { ...header, failure: event.failure }
  }
}
