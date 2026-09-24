import type Character from '#models/character'
import type TurnLog from '#models/turn_log'
import type { MarginLabel, RollOutcome } from '#services/rules/types'
import type { ContentLabels } from '#services/game/content_labels'
import CharacterTransformer from '#transformers/character_transformer'
import TurnTransformer, { presentRoll } from '#transformers/turn_transformer'

/**
 * The milestones of a turn the player is told about while it plays.
 *
 * Milestones only, not every technical step: the front turns them into waiting
 * messages, and an event it could not show would be noise. Emitted by the turn
 * code itself, never derived from the job queue's own events.
 */
export type TurnEvent =
  | { type: 'step_started'; step: 'arbitration' | 'narration' }
  /** The skill, the verdict and a qualitative margin — never the dice, the threshold or the skill value. */
  | { type: 'roll_resolved'; skill: string; result: RollOutcome; margin: MarginLabel }
  /** Everything the journal and the sheet need, so the front makes no further request. */
  | { type: 'turn_completed'; turn: TurnLog; character: Character }
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

    case 'turn_completed':
      return {
        ...header,
        turn: new TurnTransformer(event.turn, labels).toObject(),
        character: new CharacterTransformer(event.character, labels).toObject(),
      }

    case 'turn_failed':
      return { ...header, failure: event.failure }
  }
}
