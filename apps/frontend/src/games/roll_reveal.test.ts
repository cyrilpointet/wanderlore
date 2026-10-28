import { describe, expect, test } from 'vitest'

import type { Roll } from './queries'
import {
  holdsNarration,
  initialRevealState,
  liveRollOf,
  locksInput,
  revealReducer,
  type RevealAction,
  type RevealOptions,
  type RevealState,
} from './roll_reveal'

const TURN_ID = 'turn-1'
const NEXT_TURN_ID = 'turn-2'

/** A sword thrust at 60%, a 42 on the d100: a success. */
const ROLL: Roll = {
  skill: { reference: 'swordsmanship', label: 'Swordsmanship' },
  characteristic: null,
  value: 60,
  baseChance: 60,
  difficulty: 'average',
  modifiers: [],
  chance: 60,
  roll: 42,
  result: 'success',
  degree: 'success',
}

const BY_HAND: RevealOptions = { autoRoll: false, animated: true }

function received(options: RevealOptions = BY_HAND, turnId = TURN_ID): RevealAction {
  return { type: 'roll_received', turnId, roll: ROLL, ...options }
}

const thrown: RevealAction = { type: 'throw' }
const stopped: RevealAction = { type: 'dice_stopped' }
const folded: RevealAction = { type: 'folded' }

function run(...actions: RevealAction[]): RevealState {
  return actions.reduce(revealReducer, initialRevealState)
}

describe('roll reveal — thrown by hand', () => {
  test('a roll received live is set out, waiting for the player', () => {
    const state = run(received())

    expect(state).toEqual({ status: 'staged', turnId: TURN_ID, roll: ROLL, ...BY_HAND })
    expect(holdsNarration(state, TURN_ID)).toBe(true)
    expect(locksInput(state)).toBe(true)
  })

  test('the click rolls the dice, which stop, then the card folds', () => {
    const rolling = run(received(), thrown)
    expect(rolling.status).toBe('rolling')

    const landed = run(received(), thrown, stopped)
    expect(landed.status).toBe('landed')
    expect(holdsNarration(landed, TURN_ID)).toBe(true)
    expect(locksInput(landed)).toBe(true)

    const revealed = run(received(), thrown, stopped, folded)
    expect(revealed).toEqual({ status: 'revealed', turnId: TURN_ID })
    expect(holdsNarration(revealed, TURN_ID)).toBe(false)
    expect(locksInput(revealed)).toBe(false)
  })

  test('without the dice animation, the click reveals at once', () => {
    const state = run(received({ autoRoll: false, animated: false }), thrown)

    expect(state).toEqual({ status: 'revealed', turnId: TURN_ID })
  })

  test('steps out of order change nothing', () => {
    expect(run(received(), stopped).status).toBe('staged')
    expect(run(received(), folded).status).toBe('staged')
    expect(run(received(), thrown, folded).status).toBe('rolling')
    expect(run(received(), thrown, thrown).status).toBe('rolling')
    expect(run(thrown, stopped, folded)).toEqual(initialRevealState)
  })
})

describe('roll reveal — thrown automatically', () => {
  test('still set out first, for the card to throw on its own', () => {
    const state = run(received({ autoRoll: true, animated: true }))

    expect(state).toMatchObject({ status: 'staged', autoRoll: true })
    expect(run(received({ autoRoll: true, animated: true }), thrown, stopped, folded)).toEqual({
      status: 'revealed',
      turnId: TURN_ID,
    })
  })

  test('without the dice animation either, there is nothing to watch', () => {
    const state = run(received({ autoRoll: true, animated: false }))

    expect(state).toEqual({ status: 'revealed', turnId: TURN_ID })
    expect(holdsNarration(state, TURN_ID)).toBe(false)
    expect(locksInput(state)).toBe(false)
  })
})

describe('roll reveal — around the turn', () => {
  test('the turn completing before the click changes nothing: the narration still waits', () => {
    // `turn_completed` is not a reveal action: the turn joins the journal, its roll still staged.
    const state = run(received())

    expect(holdsNarration(state, TURN_ID)).toBe(true)
    expect(liveRollOf(state, TURN_ID)?.roll).toEqual(ROLL)
  })

  test('a failed turn reveals its roll at once, for the failure to take over', () => {
    for (const before of [[received()], [received(), thrown], [received(), thrown, stopped]]) {
      const state = run(...before, { type: 'turn_failed', turnId: TURN_ID })

      expect(state).toEqual({ status: 'revealed', turnId: TURN_ID })
      expect(locksInput(state)).toBe(false)
    }
  })

  test("another turn's failure leaves the roll alone", () => {
    expect(run(received(), { type: 'turn_failed', turnId: NEXT_TURN_ID }).status).toBe('staged')
  })

  test('the same roll heard twice is not played again', () => {
    expect(run(received(), thrown, received()).status).toBe('rolling')
    expect(run(received(), thrown, stopped, folded, received()).status).toBe('revealed')
  })

  test("the next turn's roll starts afresh", () => {
    const state = run(received(), thrown, stopped, folded, received(BY_HAND, NEXT_TURN_ID))

    expect(state).toMatchObject({ status: 'staged', turnId: NEXT_TURN_ID })
    expect(holdsNarration(state, TURN_ID)).toBe(false)
    expect(holdsNarration(state, NEXT_TURN_ID)).toBe(true)
  })

  test('holds only the narration of its own turn', () => {
    const state = run(received())

    expect(holdsNarration(state, NEXT_TURN_ID)).toBe(false)
    expect(holdsNarration(state, null)).toBe(false)
    expect(liveRollOf(state, NEXT_TURN_ID)).toBeNull()
  })

  test('with nothing received, nothing is held', () => {
    expect(holdsNarration(initialRevealState, TURN_ID)).toBe(false)
    expect(locksInput(initialRevealState)).toBe(false)
  })
})
