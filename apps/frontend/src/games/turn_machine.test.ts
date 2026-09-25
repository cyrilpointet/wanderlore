import { describe, expect, test } from 'vitest'

import type { Character, Turn } from './queries'
import {
  concerns,
  initialTurnState,
  isBusy,
  turnReducer,
  type TurnAction,
  type TurnMessage,
  type TurnState,
} from './turn_machine'

const KEY = 'key-1'
const NEW_KEY = 'key-2'
const TURN_ID = 'turn-1'
const INPUT = 'I draw my sword.'

const SKILL = { reference: 'swordsmanship', label: 'Swordsmanship' }
const CHARACTER = {} as Character

function turn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: TURN_ID,
    turnNumber: null,
    status: 'pending',
    playerInput: INPUT,
    roll: null,
    narration: null,
    effects: null,
    failure: null,
    ...overrides,
  }
}

function message(
  body: DistributiveOmit<TurnMessage, 'turnId' | 'idempotencyKey'>,
  ref: { turnId?: string; idempotencyKey?: string | null } = {}
): TurnMessage {
  return { turnId: TURN_ID, idempotencyKey: KEY, ...ref, ...body } as TurnMessage
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

function run(...actions: TurnAction[]): TurnState {
  return actions.reduce(turnReducer, initialTurnState)
}

const submit: TurnAction = { type: 'submit', playerInput: INPUT, key: KEY }
const accepted: TurnAction = { type: 'accepted', turn: turn() }
const on = (m: TurnMessage): TurnAction => ({ type: 'message', message: m })

describe('turn machine — a turn played to the end', () => {
  test('submitting locks the input and keeps the text and key', () => {
    const state = run(submit)

    expect(state).toEqual({
      status: 'submitting',
      submission: { playerInput: INPUT, idempotencyKey: KEY, turnId: null },
    })
    expect(isBusy(state)).toBe(true)
  })

  test('the 202 names the turn and starts the wait', () => {
    expect(run(submit, accepted)).toMatchObject({
      status: 'in_progress',
      submission: { turnId: TURN_ID },
      step: null,
      roll: null,
    })
  })

  test('without a roll: arbitration, then completion', () => {
    const waiting = run(
      submit,
      accepted,
      on(message({ event: 'step_started', step: 'arbitration' }))
    )
    expect(waiting).toMatchObject({ status: 'in_progress', step: 'arbitration' })

    const done = turnReducer(
      waiting,
      on(
        message({
          event: 'turn_completed',
          turn: turn({ status: 'completed' }),
          character: CHARACTER,
        })
      )
    )
    expect(done).toEqual(initialTurnState)
    expect(isBusy(done)).toBe(false)
  })

  test('with a roll: the chip shows while the narration is written', () => {
    const state = run(
      submit,
      accepted,
      on(message({ event: 'step_started', step: 'arbitration' })),
      on(message({ event: 'roll_resolved', skill: SKILL, result: 'success', margin: 'narrow' })),
      on(message({ event: 'step_started', step: 'narration' }))
    )

    expect(state).toMatchObject({
      status: 'in_progress',
      step: 'narration',
      roll: { skill: SKILL, result: 'success', margin: 'narrow' },
    })
  })

  test('an event arriving before the 202 is matched by the key', () => {
    const state = run(submit, on(message({ event: 'step_started', step: 'arbitration' })))

    expect(state).toMatchObject({
      status: 'in_progress',
      step: 'arbitration',
      submission: { turnId: TURN_ID, idempotencyKey: KEY },
    })
    // The late 202 changes nothing.
    expect(turnReducer(state, accepted)).toEqual(state)
  })

  test('a repeated key answered with a finished turn ends the wait at once', () => {
    expect(run(submit, { type: 'accepted', turn: turn({ status: 'completed' }) })).toEqual(
      initialTurnState
    )
  })
})

describe('turn machine — failures', () => {
  const failure = { code: 'llm_timeout', message: 'Too slow.' }

  test('turn_failed keeps the roll already shown and the failure', () => {
    const state = run(
      submit,
      accepted,
      on(
        message({
          event: 'roll_resolved',
          skill: SKILL,
          result: 'failure',
          margin: 'minor_failure',
        })
      ),
      on(message({ event: 'turn_failed', failure }))
    )

    expect(state).toMatchObject({
      status: 'failed',
      failure,
      roll: { skill: SKILL },
      submission: { playerInput: INPUT },
    })
    expect(isBusy(state)).toBe(false)
  })

  test('retry after turn_failed is a new submission, with a new key', () => {
    const state = run(submit, accepted, on(message({ event: 'turn_failed', failure })), {
      type: 'retry',
      key: NEW_KEY,
    })

    expect(state).toEqual({
      status: 'submitting',
      submission: { playerInput: INPUT, idempotencyKey: NEW_KEY, turnId: null },
    })
  })

  test('retry after a lost connection resends with the same key', () => {
    const state = run(
      submit,
      {
        type: 'submit_failed',
        failure: { code: 'network_error', message: '' },
        retryWithSameKey: true,
      },
      { type: 'retry', key: NEW_KEY }
    )

    expect(state).toMatchObject({ status: 'submitting', submission: { idempotencyKey: KEY } })
  })

  test('retry after a refused submission takes a new key', () => {
    const state = run(
      submit,
      {
        type: 'submit_failed',
        failure: { code: 'turn_queue_unavailable', message: '' },
        retryWithSameKey: false,
      },
      { type: 'retry', key: NEW_KEY }
    )

    expect(state).toMatchObject({ status: 'submitting', submission: { idempotencyKey: NEW_KEY } })
  })

  test('edit leaves the failure and unlocks the input', () => {
    expect(
      run(submit, accepted, on(message({ event: 'turn_failed', failure })), { type: 'edit' })
    ).toEqual(initialTurnState)
  })
})

describe('turn machine — refusals of the submission', () => {
  const tooLong = { code: 'input_too_long', message: '' }

  test('a refused text goes back to the field, with the reason', () => {
    const state = run(submit, { type: 'rejected', failure: tooLong })

    expect(state).toEqual({ status: 'idle', inputError: tooLong })
    expect(isBusy(state)).toBe(false)
  })

  test('changing the text clears the reason', () => {
    expect(run(submit, { type: 'rejected', failure: tooLong }, { type: 'input_changed' })).toEqual(
      initialTurnState
    )
  })

  test('sending again clears it too', () => {
    expect(run(submit, { type: 'rejected', failure: tooLong }, submit)).toMatchObject({
      status: 'submitting',
    })
  })

  test('another turn in progress: wait for that one', () => {
    const other = turn({ id: 'turn-7', playerInput: 'Someone else’s action.' })

    expect(run(submit, { type: 'superseded', turn: other })).toEqual({
      status: 'in_progress',
      submission: { playerInput: 'Someone else’s action.', idempotencyKey: null, turnId: 'turn-7' },
      step: null,
      roll: null,
    })
  })

  test('the turn in the way is already over: nothing to wait for', () => {
    expect(run(submit, { type: 'superseded', turn: turn({ status: 'completed' }) })).toEqual(
      initialTurnState
    )
    expect(run(submit, { type: 'superseded', turn: null })).toEqual(initialTurnState)
  })
})

describe('turn machine — catching up', () => {
  test('a pending turn found on opening the screen resumes the wait', () => {
    const state = turnReducer(initialTurnState, { type: 'read', turn: turn() })

    expect(state).toMatchObject({
      status: 'in_progress',
      submission: { playerInput: INPUT, idempotencyKey: null, turnId: TURN_ID },
    })
  })

  test('events of a resumed turn are matched by its id', () => {
    const resumed = turnReducer(initialTurnState, { type: 'read', turn: turn() })
    const m = message({ event: 'step_started', step: 'narration' }, { idempotencyKey: 'unknown' })

    expect(concerns(resumed, m)).toBe(true)
    expect(turnReducer(resumed, on(m))).toMatchObject({ step: 'narration' })
  })

  test('reading back a completed turn ends the wait', () => {
    expect(run(submit, accepted, { type: 'read', turn: turn({ status: 'completed' }) })).toEqual(
      initialTurnState
    )
  })

  test('reading back a failed turn shows its failure', () => {
    const failure = { code: 'turn_expired', message: 'Expired.' }

    expect(
      run(submit, accepted, { type: 'read', turn: turn({ status: 'failed', failure }) })
    ).toMatchObject({ status: 'failed', failure })
  })

  test('reading back a turn still pending keeps waiting', () => {
    expect(run(submit, accepted, { type: 'read', turn: turn() })).toMatchObject({
      status: 'in_progress',
    })
  })
})

describe('turn machine — what it ignores', () => {
  test("another turn's events", () => {
    const state = run(submit, accepted)
    const other = message(
      { event: 'turn_failed', failure: { code: 'llm_timeout', message: '' } },
      { turnId: 'turn-9', idempotencyKey: 'key-9' }
    )

    expect(turnReducer(state, on(other))).toEqual(state)
  })

  test('events while nothing is in flight', () => {
    expect(
      turnReducer(initialTurnState, on(message({ event: 'step_started', step: 'arbitration' })))
    ).toEqual(initialTurnState)
  })

  test('a second submission while one is in flight', () => {
    const state = run(submit, accepted)

    expect(turnReducer(state, { type: 'submit', playerInput: 'Again', key: NEW_KEY })).toEqual(
      state
    )
  })

  test('a late failure of the POST once the turn is known', () => {
    const state = run(submit, accepted)

    expect(
      turnReducer(state, {
        type: 'submit_failed',
        failure: { code: 'network_error', message: '' },
        retryWithSameKey: true,
      })
    ).toEqual(state)
  })
})
