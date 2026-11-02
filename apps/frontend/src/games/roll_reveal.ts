import type { Roll } from './queries'

/**
 * The live rolls of a turn, front side: thrown by the player, though the
 * backend drew each d100 before the front ever heard of it (front spec,
 * section 5.3.7). A round of combat brings two — the attack, then the
 * defence against the riposte — thrown one after the other, on the same card.
 *
 * ```
 * none ──roll_received──▶ staged ──throw──▶ rolling ──dice_stopped──▶ landed ──folded──▶ next roll?
 *                            │                 (dice not animated) ────────────────────────▶ next roll?
 *                            └── automatic and not animated: straight to revealed
 * next roll? ── one queued ──▶ staged     ── none left ──▶ revealed
 * any state of that turn ──turn_failed──▶ revealed
 * ```
 *
 * Apart from `turnReducer`, which goes back to `idle` on `turn_completed`:
 * the turn may be over and in the journal while its narration still waits
 * for the dice. Pure, like `turnReducer`: it reads no clock and starts no
 * timer — the card tells it when the dice stop and when it has folded.
 *
 * Only a `roll_resolved` received live opens it. A turn read back — on
 * reopening the screen, catching up, in the history — never has its rolls
 * played again.
 */

/** How the rolls are to be shown, read from the preferences when the first arrives. */
export type RevealOptions = {
  /** The dice are thrown without waiting for the player. */
  autoRoll: boolean
  /** The dice roll on screen; otherwise the outcome shows at once. */
  animated: boolean
}

/** A turn's rolls while one of them is on its card. */
type Playing = {
  turnId: string
  /** The roll on the card. */
  roll: Roll
  /** The rolls of the turn already thrown, shown as chips before the card. */
  done: Roll[]
  /** The rolls still to throw after this one, kept out of sight. */
  queued: Roll[]
} & RevealOptions

export type RevealState =
  | { status: 'none' }
  /** The roll set out, the button waiting — or, automatic, about to be thrown. */
  | ({ status: 'staged' } & Playing)
  | ({ status: 'rolling' } & Playing)
  /** The dice stopped on the d100, the degree shown, the card about to fold. */
  | ({ status: 'landed' } & Playing)
  /** Over: every roll of the turn as a chip, announced once, the narration shown. */
  | { status: 'revealed'; turnId: string; rolls: Roll[] }

export type RevealAction =
  /**
   * A roll heard live. `rolls` is every roll of the turn heard so far, in
   * order: the ones the machine does not know yet join the queue, and an
   * event heard twice adds nothing.
   */
  | ({ type: 'roll_received'; turnId: string; rolls: Roll[] } & RevealOptions)
  /** The player's click — or the card itself, when the throw is automatic. */
  | { type: 'throw' }
  | { type: 'dice_stopped' }
  | { type: 'folded' }
  /** The turn failed after its rolls: nothing to wait for, the failure takes over. */
  | { type: 'turn_failed'; turnId: string }

/** A roll still being played out on its card. */
export type LiveRoll = Extract<RevealState, { status: 'staged' | 'rolling' | 'landed' }>

export const initialRevealState: RevealState = { status: 'none' }

export function revealReducer(state: RevealState, action: RevealAction): RevealState {
  switch (action.type) {
    case 'roll_received': {
      const { turnId, rolls, autoRoll, animated } = action
      const known = state.status !== 'none' && state.turnId === turnId ? rollsOf(state) : []
      const fresh = rolls.slice(known.length)
      if (fresh.length === 0) return state

      // A roll already on its card: the new one waits its turn.
      if (isPlaying(state) && state.turnId === turnId) {
        return { ...state, queued: [...state.queued, ...fresh] }
      }
      return play({ turnId, done: known, pending: fresh, autoRoll, animated })
    }

    case 'throw':
      if (state.status !== 'staged') return state
      if (!state.animated) return next(state)
      return { ...state, status: 'rolling' }

    case 'dice_stopped':
      return state.status === 'rolling' ? { ...state, status: 'landed' } : state

    case 'folded':
      return state.status === 'landed' ? next(state) : state

    case 'turn_failed':
      if (!isPlaying(state) || state.turnId !== action.turnId) return state
      return { status: 'revealed', turnId: state.turnId, rolls: rollsOf(state) }
  }
}

/** The rolls of a turn to throw, from the first not yet thrown. */
function play({
  turnId,
  done,
  pending,
  autoRoll,
  animated,
}: { turnId: string; done: Roll[]; pending: Roll[] } & RevealOptions): RevealState {
  if (autoRoll && !animated) return { status: 'revealed', turnId, rolls: [...done, ...pending] }

  const [roll, ...queued] = pending
  return { status: 'staged', turnId, roll: roll!, done, queued, autoRoll, animated }
}

/** The roll on the card thrown: the next one set out, or the turn's rolls all revealed. */
function next(state: LiveRoll): RevealState {
  const done = [...state.done, state.roll]
  const [roll, ...queued] = state.queued
  if (!roll) return { status: 'revealed', turnId: state.turnId, rolls: done }
  return { ...state, status: 'staged', roll, done, queued }
}

function isPlaying(state: RevealState): state is LiveRoll {
  return state.status === 'staged' || state.status === 'rolling' || state.status === 'landed'
}

/** Every roll of the turn the machine knows of, thrown or not, in order. */
function rollsOf(state: Exclude<RevealState, { status: 'none' }>): Roll[] {
  return state.status === 'revealed' ? state.rolls : [...state.done, state.roll, ...state.queued]
}

/** The roll of this turn still being played out on its card. */
export function liveRollOf(state: RevealState, turnId: string | null): LiveRoll | null {
  return isPlaying(state) && state.turnId === turnId ? state : null
}

/** Whether this turn's narration waits for its dice: until its last roll is revealed. */
export function holdsNarration(state: RevealState, turnId: string | null): boolean {
  return liveRollOf(state, turnId) !== null
}

/** Whether the player must throw, or watch, the dice before acting again. */
export function locksInput(state: RevealState): boolean {
  return isPlaying(state)
}

/** The last roll revealed, the one to announce: none while the first is still on its card. */
export function lastRevealed(state: RevealState): Roll | null {
  if (state.status === 'none') return null
  const revealed = state.status === 'revealed' ? state.rolls : state.done
  return revealed.at(-1) ?? null
}
