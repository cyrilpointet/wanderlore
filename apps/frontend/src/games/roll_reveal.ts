import type { Roll } from './queries'

/**
 * A live roll, front side: thrown by the player, though the backend drew the
 * d100 before the front ever heard of it (front spec, section 5.3.7).
 *
 * ```
 * none ──roll_received──▶ staged ──throw──▶ rolling ──dice_stopped──▶ landed ──folded──▶ revealed
 *                            │                 (dice not animated) ──────────────────────▶ revealed
 *                            └── automatic and not animated: straight to revealed
 * any state of that turn ──turn_failed──▶ revealed
 * ```
 *
 * Apart from `turnReducer`, which goes back to `idle` on `turn_completed`:
 * the turn may be over and in the journal while its narration still waits
 * for the dice. Pure, like `turnReducer`: it reads no clock and starts no
 * timer — the card tells it when the dice stop and when it has folded.
 *
 * Only a `roll_resolved` received live opens it. A turn read back — on
 * reopening the screen, catching up, in the history — never has its roll
 * played again.
 */

/** How the roll is to be shown, read from the preferences when it arrives. */
export type RevealOptions = {
  /** The dice are thrown without waiting for the player. */
  autoRoll: boolean
  /** The dice roll on screen; otherwise the outcome shows at once. */
  animated: boolean
}

export type RevealState =
  | { status: 'none' }
  /** The roll set out, the button waiting — or, automatic, about to be thrown. */
  | ({ status: 'staged'; turnId: string; roll: Roll } & RevealOptions)
  | ({ status: 'rolling'; turnId: string; roll: Roll } & RevealOptions)
  /** The dice stopped on the d100, the degree shown, the card about to fold. */
  | ({ status: 'landed'; turnId: string; roll: Roll } & RevealOptions)
  /** Over: the roll as a chip, the narration shown. */
  | { status: 'revealed'; turnId: string }

export type RevealAction =
  | ({ type: 'roll_received'; turnId: string; roll: Roll } & RevealOptions)
  /** The player's click — or the card itself, when the throw is automatic. */
  | { type: 'throw' }
  | { type: 'dice_stopped' }
  | { type: 'folded' }
  /** The turn failed after its roll: nothing to wait for, the failure takes over. */
  | { type: 'turn_failed'; turnId: string }

/** A roll still being played out on its card. */
export type LiveRoll = Extract<RevealState, { roll: Roll }>

export const initialRevealState: RevealState = { status: 'none' }

export function revealReducer(state: RevealState, action: RevealAction): RevealState {
  switch (action.type) {
    case 'roll_received': {
      // One roll per turn: an event heard twice never replays it.
      if (state.status !== 'none' && state.turnId === action.turnId) return state

      const { turnId, roll, autoRoll, animated } = action
      if (autoRoll && !animated) return { status: 'revealed', turnId }
      return { status: 'staged', turnId, roll, autoRoll, animated }
    }

    case 'throw':
      if (state.status !== 'staged') return state
      if (!state.animated) return { status: 'revealed', turnId: state.turnId }
      return { ...state, status: 'rolling' }

    case 'dice_stopped':
      return state.status === 'rolling' ? { ...state, status: 'landed' } : state

    case 'folded':
      return state.status === 'landed' ? { status: 'revealed', turnId: state.turnId } : state

    case 'turn_failed':
      if (state.status === 'none' || state.status === 'revealed') return state
      if (state.turnId !== action.turnId) return state
      return { status: 'revealed', turnId: state.turnId }
  }
}

/** The roll of this turn still being played out on its card. */
export function liveRollOf(state: RevealState, turnId: string | null): LiveRoll | null {
  if (turnId === null || !('roll' in state) || state.turnId !== turnId) return null
  return state
}

/** Whether this turn's narration waits for its dice. */
export function holdsNarration(state: RevealState, turnId: string | null): boolean {
  return liveRollOf(state, turnId) !== null
}

/** Whether the player must throw, or watch, the dice before acting again. */
export function locksInput(state: RevealState): boolean {
  return state.status === 'staged' || state.status === 'rolling' || state.status === 'landed'
}
