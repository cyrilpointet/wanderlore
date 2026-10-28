import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { heldInFlight, waitsForDice, type Completion } from './held_turn'
import type { Roll, Turn } from './queries'
import {
  initialRevealState,
  revealReducer,
  type RevealAction,
  type RevealState,
} from './roll_reveal'
import { TurnInFlight } from './turn_in_flight'
import type { TurnState } from './turn_machine'

const TURN_ID = 'turn-1'
const NARRATION = 'Tréville reads the letter and smiles.'

/** Persuasion at 60%, a 42 on the d100: a success. */
const ROLL: Roll = {
  skill: { reference: 'persuasion', label: 'Persuasion' },
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

const TOLD: Extract<TurnState, { status: 'in_progress' }> = {
  status: 'in_progress',
  submission: { playerInput: 'I hand him the letter.', idempotencyKey: 'key', turnId: TURN_ID },
  step: 'narration',
  roll: ROLL,
  narration: NARRATION,
}

const COMPLETED: Turn = {
  id: TURN_ID,
  turnNumber: 3,
  status: 'completed',
  playerInput: 'I hand him the letter.',
  roll: ROLL,
  narration: NARRATION,
  effects: { hitPointsDelta: 0, movement: null, items: [] },
  failure: null,
}

function reveal(...actions: RevealAction[]): RevealState {
  return actions.reduce(revealReducer, initialRevealState)
}

const received = (turnId = TURN_ID): RevealAction => ({
  type: 'roll_received',
  turnId,
  roll: ROLL,
  autoRoll: false,
  animated: true,
})
const STAGED = reveal(received())
const REVEALED = reveal(received(), { type: 'throw' }, { type: 'dice_stopped' }, { type: 'folded' })

function render(state: Exclude<TurnState, { status: 'idle' }>, revealState: RevealState): string {
  return renderToStaticMarkup(
    <TurnInFlight
      state={state}
      reveal={revealState}
      onThrow={() => {}}
      onDiceStopped={() => {}}
      onFolded={() => {}}
      onRetry={() => {}}
      onEdit={() => {}}
    />
  )
}

describe('live roll | the turn in flight', () => {
  test('a roll waiting for its dice shows its card, the narration kept back', () => {
    const markup = render(TOLD, STAGED)

    expect(markup).toContain('Roll the dice')
    expect(markup).not.toContain(NARRATION)
    expect(markup).not.toContain('rolled 42')
  })

  test('the dice thrown, the roll folds into its chip and the narration fades in', () => {
    const markup = render(TOLD, REVEALED)

    expect(markup).not.toContain('Roll the dice')
    expect(markup).toContain('Persuasion 60% · rolled 42 · Success')
    expect(markup).toContain(NARRATION)
    expect(markup).toContain('animate-fade-in')
  })

  test('a roll never received live — read back — is shown as a chip at once', () => {
    const markup = render(TOLD, initialRevealState)

    expect(markup).not.toContain('Roll the dice')
    expect(markup).toContain('rolled 42')
    expect(markup).toContain(NARRATION)
  })

  test("another turn's dice leave this one alone", () => {
    const markup = render(TOLD, reveal(received('turn-0')))

    expect(markup).not.toContain('Roll the dice')
    expect(markup).toContain(NARRATION)
  })

  test('a failed turn shows its roll as a chip, then the failure', () => {
    const failed = reveal(received(), { type: 'turn_failed', turnId: TURN_ID })
    const markup = render(
      {
        status: 'failed',
        submission: TOLD.submission,
        roll: ROLL,
        failure: { code: 'llm_timeout', message: '' },
      },
      failed
    )

    expect(markup).toContain('rolled 42')
    expect(markup).toContain('role="alert"')
    expect(markup).not.toContain('Roll the dice')
  })
})

describe('live roll | a turn over before its dice', () => {
  const completion: Completion = { turn: COMPLETED }

  test('waits for its dice: neither recorded, nor read aloud, nor on the sheet', () => {
    // Recording is what writes the journal and the sheet and hands the narration to the voice.
    expect(waitsForDice(STAGED, completion)).toBe(true)
    expect(waitsForDice(reveal(received(), { type: 'throw' }), completion)).toBe(true)
  })

  test('is recorded at once once its dice are thrown, or when it had none to throw', () => {
    expect(waitsForDice(REVEALED, completion)).toBe(false)
    expect(waitsForDice(initialRevealState, completion)).toBe(false)
    expect(waitsForDice(reveal(received('turn-0')), completion)).toBe(false)
  })

  test('stays where the turn in flight was, with the same card', () => {
    const held = heldInFlight(completion)

    expect(held).toMatchObject({
      status: 'in_progress',
      submission: { turnId: TURN_ID, playerInput: 'I hand him the letter.' },
      roll: ROLL,
      narration: NARRATION,
    })
    expect(render(held, STAGED)).toContain('Roll the dice')
    expect(render(held, STAGED)).not.toContain(NARRATION)
  })
})
