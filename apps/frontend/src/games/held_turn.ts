import type { Period } from '@/api/enums'
import type { ContentLabel } from '@/api/types'
import type { Character, Turn } from './queries'
import { holdsNarration, type RevealState } from './roll_reveal'
import type { TurnState } from './turn_machine'

/**
 * A finished turn as it is recorded: the turn, and — when `turn_completed`
 * carried them — the sheet, the place and the period it left the game in.
 */
export type Completion = {
  turn: Turn
  character?: Character
  location?: ContentLabel | null
  period?: Period
}

/**
 * Whether a finished turn must wait for its dice before it is recorded. The
 * turn can be over before the player has thrown them (front spec, section
 * 5.3.7): recorded at once, its narration would be read aloud and its hit
 * points shown in the header, giving the outcome away before the dice.
 */
export function waitsForDice(reveal: RevealState, completion: Completion): boolean {
  return holdsNarration(reveal, completion.turn.id)
}

/**
 * The finished turn kept where the turn in flight was, its card in place,
 * until its dice are thrown: shown as a turn still being told, so the card
 * on screen is the same one, not drawn again.
 */
export function heldInFlight({ turn }: Completion): Extract<TurnState, { status: 'in_progress' }> {
  return {
    status: 'in_progress',
    submission: { playerInput: turn.playerInput, idempotencyKey: null, turnId: turn.id },
    step: 'narration',
    roll: turn.roll,
    narration: turn.narration,
  }
}
