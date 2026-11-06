import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import '@/i18n'
import { heldInFlight, waitsForDice, type Completion } from './held_turn'
import type { Roll, Turn } from './queries'
import { DiceTray } from './dice_tray'
import {
  initialRevealState,
  liveRollOf,
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
  combat: null,
}

/** A round of combat: a sword thrust that hits for 7, then a parry that fails. */
const ATTACK: Roll = {
  ...ROLL,
  skill: { reference: 'swordsmanship', label: 'Swordsmanship' },
  roll: 23,
  combat: {
    role: 'attack',
    opponent: { reference: 'jussac', label: 'Jussac', rank: null },
    outcome: 'hit',
    damage: { weapon: 5, modifier: 2, armor: 0, total: 7, effect: null },
  },
}
const PARRY: Roll = {
  ...ROLL,
  skill: { reference: 'swordsmanship', label: 'Swordsmanship' },
  roll: 88,
  result: 'failure',
  degree: 'failure',
  combat: {
    role: 'defense',
    opponent: { reference: 'cahusac', label: null, rank: 2 },
    defense: 'parry',
    outcome: 'struck',
  },
}

const TOLD: Extract<TurnState, { status: 'in_progress' }> = {
  status: 'in_progress',
  submission: { playerInput: 'I hand him the letter.', idempotencyKey: 'key', turnId: TURN_ID },
  step: 'narration',
  rolls: [ROLL],
  narration: NARRATION,
}

const COMPLETED: Turn = {
  id: TURN_ID,
  turnNumber: 3,
  status: 'completed',
  playerInput: 'I hand him the letter.',
  rolls: [ROLL],
  narration: NARRATION,
  effects: { hitPointsDelta: 0, movement: null, items: [] },
  failure: null,
}

function reveal(...actions: RevealAction[]): RevealState {
  return actions.reduce(revealReducer, initialRevealState)
}

const received = (turnId = TURN_ID, rolls: Roll[] = [ROLL]): RevealAction => ({
  type: 'roll_received',
  turnId,
  rolls,
  autoRoll: false,
  animated: true,
})
const thrown: RevealAction[] = [{ type: 'throw' }, { type: 'dice_stopped' }, { type: 'folded' }]
const STAGED = reveal(received())
const REVEALED = reveal(received(), { type: 'throw' }, { type: 'dice_stopped' }, { type: 'folded' })

/** The turn on the sheet and the dice tray, as the game screen lays them out. */
function render(state: Exclude<TurnState, { status: 'idle' }>, revealState: RevealState): string {
  return renderToStaticMarkup(
    <>
      <TurnInFlight state={state} reveal={revealState} onRetry={() => {}} onEdit={() => {}} />
      <DiceTray
        live={liveRollOf(revealState, state.submission.turnId)}
        onThrow={() => {}}
        onDiceStopped={() => {}}
        onFolded={() => {}}
      >
        {null}
      </DiceTray>
    </>
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
    expect(markup).toContain('>Persuasion 60%</span><span> · rolled 42</span>')
    expect(markup).toContain('>Success</span>')
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
        rolls: [ROLL],
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
      rolls: [ROLL],
      narration: NARRATION,
    })
    expect(render(held, STAGED)).toContain('Roll the dice')
    expect(render(held, STAGED)).not.toContain(NARRATION)
  })
})

describe('live roll | a round of combat', () => {
  const FOUGHT: Extract<TurnState, { status: 'in_progress' }> = {
    ...TOLD,
    rolls: [ATTACK, PARRY],
  }
  const BOTH = received(TURN_ID, [ATTACK, PARRY])

  test('the attack on its card first, the defence out of sight', () => {
    const markup = render(FOUGHT, reveal(received(TURN_ID, [ATTACK]), BOTH))

    expect(markup).toContain('Roll the dice')
    expect(markup).not.toContain('rolled 88')
    expect(markup).not.toContain('Parry')
    expect(markup).not.toContain(NARRATION)
  })

  test('the attack thrown, it folds into its chip with its damage, and the parry is set out', () => {
    const markup = render(FOUGHT, reveal(BOTH, ...thrown))

    expect(markup).toContain('<span> · Swordsmanship 60%</span><span> · rolled 23</span>')
    expect(markup).toContain('>Success · Hit</span>')
    expect(markup).toContain('Damage 5 · Damage modifier +2 · → 7 dealt')
    expect(markup).toContain('Parry')
    expect(markup).toContain('Roll the dice')
    expect(markup).not.toContain('rolled 88')
    expect(markup).not.toContain(NARRATION)
  })

  test('both thrown, both chips in order, then the narration', () => {
    const markup = render(FOUGHT, reveal(BOTH, ...thrown, ...thrown))

    expect(markup).not.toContain('Roll the dice')
    expect(markup.indexOf('rolled 23')).toBeLessThan(markup.indexOf('rolled 88'))
    expect(markup).toContain(
      '>Parry against unknown opponent 2</span><span> · Swordsmanship 60%</span><span> · rolled 88</span>'
    )
    expect(markup).toContain('>Failure · Blow taken</span>')
    expect(markup).toContain(NARRATION)
  })

  test('a turn over before its second roll waits for it', () => {
    const completion: Completion = { turn: { ...COMPLETED, rolls: [ATTACK, PARRY] } }

    expect(waitsForDice(reveal(BOTH, ...thrown), completion)).toBe(true)
    expect(waitsForDice(reveal(BOTH, ...thrown, ...thrown), completion)).toBe(false)
  })
})
